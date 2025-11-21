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
    const records = metrics.map(metric => ({
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

