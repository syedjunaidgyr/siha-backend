import axios from 'axios';
import { Op } from 'sequelize';
import MetricRecord from '../models/MetricRecord';
import User from '../models/User';

const DEFAULT_AI_BASE_URL = 'http://192.168.0.101:3001/api';

interface InsightOptions {
  lookbackDays?: number;
  userProfile?: Record<string, any>;
  metricsOverride?: Array<Record<string, any>>;
}

export class PreventiveHealthService {
  private static get baseUrl(): string {
    const url = process.env.AI_SERVICE_PYTHON_URL || DEFAULT_AI_BASE_URL;
    // Log the URL being used (only once to avoid spam)
    if (!(this as any)._urlLogged) {
      console.log(`[PreventiveHealthService] Using AI service URL: ${url}`);
      console.log(`[PreventiveHealthService] Environment variable AI_SERVICE_PYTHON_URL: ${process.env.AI_SERVICE_PYTHON_URL || 'not set'}`);
      (this as any)._urlLogged = true;
    }
    return url;
  }

  static async getInsights(userId: string, options?: InsightOptions) {
    const lookbackDays = options?.lookbackDays && options.lookbackDays > 0
      ? options.lookbackDays
      : 14;
    const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const metricsPayload = options?.metricsOverride ?? await this.fetchMetrics(userId, fromDate);

    if (!metricsPayload.length) {
      throw new Error('No metrics available for preventive insights');
    }

    try {
      // Validate metrics before sending
      if (!Array.isArray(metricsPayload)) {
        throw new Error('Metrics payload must be an array');
      }
      
      if (metricsPayload.length === 0) {
        throw new Error('No metrics available for preventive insights');
      }

      console.log(`[PreventiveHealthService] Sending ${metricsPayload.length} metrics to AI service`);
      
      const response = await axios.post(
        `${this.baseUrl}/ai/preventive-health`,
        {
          metrics: metricsPayload,
          lookbackDays,
          userProfile: options?.userProfile,
        },
        { timeout: 120_000 } // 2 minutes - increased from 30s to handle complex analysis
      );
      return response.data.result;
    } catch (error: any) {
      // Log detailed error information
      if (error.response) {
        console.error('[PreventiveHealthService] AI service error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: error.config?.url,
        });
      } else if (error.request) {
        console.error('[PreventiveHealthService] AI service request error:', {
          message: error.message,
          code: error.code,
          url: error.config?.url,
        });
      } else {
        console.error('[PreventiveHealthService] AI request failed:', error.message);
      }
      throw this.mapError(error);
    }
  }

  private static async fetchMetrics(userId: string, fromDate: Date) {
    const records = await MetricRecord.findAll({
      where: {
        user_id: userId,
        start_time: { [Op.gte]: fromDate },
      },
      attributes: ['metric_type', 'value', 'unit', 'start_time', 'source', 'confidence'],
      order: [['start_time', 'ASC']],
      limit: 1000,
    });

    return records.map(record => ({
      type: record.metric_type,
      value: Number(record.value),
      unit: record.unit,
      timestamp: record.start_time,
      source: record.source,
      confidence: record.confidence,
    }));
  }

  private static mapError(error: any): Error {
    if (error.response?.data?.error) {
      return new Error(error.response.data.error);
    }
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    return new Error('Unable to generate preventive insights');
  }

  static buildUserProfilePayload(user?: User) {
    if (!user) {
      return undefined;
    }

    const height = user.height ? Number(user.height) : undefined;
    const weight = user.weight ? Number(user.weight) : undefined;
    const age = user.date_of_birth ? this.calculateAge(user.date_of_birth) : undefined;

    return {
      id: user.id,
      gender: user.gender,
      heightCm: height,
      weightKg: weight,
      age,
      dateOfBirth: user.date_of_birth?.toISOString(),
      goal: user.goal,
      profileComplete: user.profile_complete,
    };
  }

  private static calculateAge(dob: Date): number {
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }
}

