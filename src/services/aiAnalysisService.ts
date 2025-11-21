import axios from 'axios';

export interface VitalSigns {
  heartRate?: number;
  stressLevel?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  bloodPressure?: { systolic: number; diastolic: number };
  confidence?: number;
  timestamp?: Date | string | number;
  [key: string]: any;
}

export interface FaceAnalysisResult {
  vitals: VitalSigns;
  faceDetected: boolean;
  analysisDuration?: number;
  duration?: string | number;
  frameCount?: number;
  avgQualityScore?: string;
  [key: string]: any;
}

const DEFAULT_AI_BASE_URL = 'http://localhost:3001/api';

export class AIAnalysisService {
  private static get baseUrl(): string {
    return process.env.AI_SERVICE_PYTHON_URL || DEFAULT_AI_BASE_URL;
  }

  static async analyzeImageFrame(imageBuffer: Buffer, sensorData?: any): Promise<FaceAnalysisResult> {
    if (!imageBuffer) {
      throw new Error('Image buffer is required');
    }

    const payload: Record<string, any> = {
      image: imageBuffer.toString('base64'),
    };

    if (sensorData) {
      payload.sensorData = sensorData;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/ai/analyze-image`,
        payload,
        { timeout: 60_000 }
      );
      return response.data.result;
    } catch (error: any) {
      console.error('Python AI analyze-image error:', error?.response?.data || error.message);
      throw this.mapError(error, 'Image analysis failed');
    }
  }

  static async analyzeVideoFrames(frames: Buffer[], sensorData?: any): Promise<FaceAnalysisResult> {
    if (!frames || frames.length === 0) {
      throw new Error('No frames provided for analysis');
    }

    const base64Frames = frames.map(frame => frame.toString('base64'));

    const payload: Record<string, any> = {
      frames: base64Frames,
    };

    if (sensorData) {
      payload.sensorData = sensorData;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/ai/analyze-video`,
        payload,
        { timeout: 120_000 }
      );
      return response.data.result;
    } catch (error: any) {
      console.error('Python AI analyze-video error:', error?.response?.data || error.message);
      throw this.mapError(error, 'Video analysis failed');
    }
  }

  private static mapError(error: any, fallbackMessage: string): Error {
    if (error.response?.data?.error) {
      return new Error(`${fallbackMessage}: ${error.response.data.error}`);
    }
    if (error.response?.data?.message) {
      return new Error(`${fallbackMessage}: ${error.response.data.message}`);
    }
    if (error.message) {
      return new Error(`${fallbackMessage}: ${error.message}`);
    }
    return new Error(fallbackMessage);
  }
}

