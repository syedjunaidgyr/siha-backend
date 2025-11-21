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

    // Limit frame count to prevent memory issues (max 12 frames for safety)
    const MAX_FRAMES = 12;
    const MAX_PAYLOAD_MB = 20; // Maximum payload size in MB
    
    if (frames.length > MAX_FRAMES) {
      console.warn(`[AIAnalysisService] Frame count (${frames.length}) exceeds maximum (${MAX_FRAMES}). Using first ${MAX_FRAMES} frames.`);
      frames = frames.slice(0, MAX_FRAMES);
    }

    // Log payload size for debugging
    const base64Frames = frames.map(frame => frame.toString('base64'));
    const payloadSize = JSON.stringify({ frames: base64Frames, sensorData }).length;
    const payloadSizeMB = (payloadSize / (1024 * 1024)).toFixed(2);
    console.log(`[AIAnalysisService] Sending ${frames.length} frames to Python service, payload size: ${payloadSizeMB} MB`);

    // Check payload size and reject if too large
    if (parseFloat(payloadSizeMB) > MAX_PAYLOAD_MB) {
      const errorMsg = `Payload too large (${payloadSizeMB} MB). Maximum allowed: ${MAX_PAYLOAD_MB} MB. Please reduce the number of frames or image resolution.`;
      console.error(`[AIAnalysisService] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Warn if payload is large but still acceptable
    if (parseFloat(payloadSizeMB) > 15) {
      console.warn(`[AIAnalysisService] WARNING: Large payload (${payloadSizeMB} MB). This may cause memory issues.`);
    }

    const payload: Record<string, any> = {
      frames: base64Frames,
    };

    if (sensorData) {
      payload.sensorData = sensorData;
    }

    try {
      // Increased timeout to 5 minutes for large payloads
      // Also increase maxContentLength and maxBodyLength for axios
      const response = await axios.post(
        `${this.baseUrl}/ai/analyze-video`,
        payload,
        { 
          timeout: 300_000, // 5 minutes
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.result;
    } catch (error: any) {
      console.error('Python AI analyze-video error:', error?.response?.data || error.message);
      
      // Provide more specific error messages
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Video analysis timed out. The payload may be too large. Try reducing the number of frames.');
      }
      if (error.code === 'ECONNRESET' || error.message?.includes('socket hang up')) {
        throw new Error('Connection to AI service was reset. The payload may be too large or the service may have crashed. Try reducing the number of frames.');
      }
      
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

