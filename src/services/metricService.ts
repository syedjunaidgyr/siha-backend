import { Op } from 'sequelize';
import MetricRecord from '../models/MetricRecord';
import Device from '../models/Device';

export interface MetricInput {
  metric_type: string;
  value: number;
  unit: string;
  start_time: Date;
  end_time?: Date;
  source: string;
  raw_payload?: object;
  confidence?: number;
  device_id?: string;
}

export class MetricService {
  static async createMetric(userId: string, metric: MetricInput) {
    return await MetricRecord.create({
      user_id: userId,
      device_id: metric.device_id,
      metric_type: metric.metric_type as any,
      value: metric.value,
      unit: metric.unit,
      start_time: metric.start_time,
      end_time: metric.end_time,
      source: metric.source,
      raw_payload: metric.raw_payload,
      confidence: metric.confidence,
    });
  }

  static async createBatchMetrics(userId: string, metrics: MetricInput[]) {
    // Filter out invalid metrics before saving
    const MIN_CONFIDENCE = 0.5;
    const validMetrics = metrics.filter(metric => {
      // Skip if value is null, undefined, or 0 (invalid for vital signs)
      // Note: 0 is valid for steps count, but not for vital signs like heart rate, temperature, etc.
      const vitalSignTypes = [
        'heart_rate', 'stress_level', 'oxygen_saturation', 'respiratory_rate', 
        'temperature', 'blood_pressure_systolic', 'blood_pressure_diastolic'
      ];
      
      if (vitalSignTypes.includes(metric.metric_type)) {
        if (metric.value === null || metric.value === undefined || metric.value === 0) {
          console.warn(`[MetricService] Skipping vital sign metric with invalid value: ${metric.metric_type} = ${metric.value}`);
          return false;
        }
      }
      
      // Skip if confidence is too low (fallback scenario) - applies to all sources
      if (metric.confidence !== undefined && metric.confidence !== null) {
        const confidence = typeof metric.confidence === 'string' ? parseFloat(metric.confidence) : metric.confidence;
        if (!isNaN(confidence) && confidence < MIN_CONFIDENCE) {
          console.warn(`[MetricService] Skipping metric with low confidence: ${metric.metric_type} confidence=${confidence} < ${MIN_CONFIDENCE} (source: ${metric.source})`);
          return false;
        }
      }
      
      return true;
    });

    if (validMetrics.length === 0) {
      console.warn('[MetricService] No valid metrics to save after filtering');
      return [];
    }

    const records = validMetrics.map(metric => ({
      user_id: userId,
      device_id: metric.device_id,
      metric_type: metric.metric_type as any,
      value: metric.value,
      unit: metric.unit,
      start_time: metric.start_time,
      end_time: metric.end_time,
      source: metric.source,
      raw_payload: metric.raw_payload,
      confidence: metric.confidence,
    }));

    return await MetricRecord.bulkCreate(records);
  }

  static async getMetrics(
    userId: string,
    options: {
      metric_type?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { user_id: userId };

    if (options.metric_type) {
      where.metric_type = options.metric_type;
    }

    if (options.from || options.to) {
      where.start_time = {};
      if (options.from) {
        where.start_time[Op.gte] = options.from;
      }
      if (options.to) {
        where.start_time[Op.lte] = options.to;
      }
    }

    return await MetricRecord.findAndCountAll({
      where,
      include: [
        {
          model: Device,
          as: 'device',
          attributes: ['id', 'vendor', 'device_name'],
        },
      ],
      order: [['start_time', 'DESC']],
      limit: options.limit || 100,
      offset: options.offset || 0,
    });
  }

  static async getMetricSummary(userId: string, metricType: string, from: Date, to: Date) {
    const metrics = await MetricRecord.findAll({
      where: {
        user_id: userId,
        metric_type: metricType,
        start_time: {
          [Op.between]: [from, to],
        },
      },
      attributes: [
        [MetricRecord.sequelize!.fn('AVG', MetricRecord.sequelize!.col('value')), 'avg'],
        [MetricRecord.sequelize!.fn('MIN', MetricRecord.sequelize!.col('value')), 'min'],
        [MetricRecord.sequelize!.fn('MAX', MetricRecord.sequelize!.col('value')), 'max'],
        [MetricRecord.sequelize!.fn('COUNT', MetricRecord.sequelize!.col('id')), 'count'],
      ],
    });

    return metrics[0] || { avg: 0, min: 0, max: 0, count: 0 };
  }
}

