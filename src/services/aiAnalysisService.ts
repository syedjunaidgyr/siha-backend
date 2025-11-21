import axios from 'axios';
import sharp from 'sharp';

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

  /**
   * Compress frames to reduce payload size
   */
  private static async compressFrames(
    frames: Buffer[], 
    targetMaxWidth: number = 1920, 
    targetMaxHeight: number = 1080,
    quality: number = 85
  ): Promise<Buffer[]> {
    console.log(`[AIAnalysisService] Compressing ${frames.length} frames (max: ${targetMaxWidth}x${targetMaxHeight}, quality: ${quality}%)`);
    
    const compressedFrames = await Promise.all(
      frames.map(async (frame, index) => {
        try {
          const image = sharp(frame);
          const metadata = await image.metadata();
          
          // Calculate if resizing is needed
          const needsResize = metadata.width && metadata.height && 
            (metadata.width > targetMaxWidth || metadata.height > targetMaxHeight);
          
          if (needsResize) {
            const ratio = Math.min(
              targetMaxWidth / (metadata.width || 1),
              targetMaxHeight / (metadata.height || 1)
            );
            const newWidth = Math.round((metadata.width || 1) * ratio);
            const newHeight = Math.round((metadata.height || 1) * ratio);
            
            console.log(`[AIAnalysisService] Frame ${index + 1}: Resizing from ${metadata.width}x${metadata.height} to ${newWidth}x${newHeight}`);
            
            return await image
              .resize(newWidth, newHeight, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality, mozjpeg: true })
              .toBuffer();
          } else {
            // Just recompress with lower quality if not resizing
            return await image
              .jpeg({ quality, mozjpeg: true })
              .toBuffer();
          }
        } catch (error: any) {
          console.warn(`[AIAnalysisService] Failed to compress frame ${index + 1}, using original: ${error.message}`);
          return frame; // Return original if compression fails
        }
      })
    );
    
    return compressedFrames;
  }

  static async analyzeVideoFrames(frames: Buffer[], sensorData?: any): Promise<FaceAnalysisResult> {
    if (!frames || frames.length === 0) {
      throw new Error('No frames provided for analysis');
    }

    // Limit frame count to prevent memory issues (max 12 frames for safety)
    const MAX_FRAMES = 12;
    const MAX_PAYLOAD_MB = 20; // Maximum payload size in MB
    const WARNING_PAYLOAD_MB = 15; // Warn if payload is large
    const TARGET_PAYLOAD_MB = 18; // Target size after compression
    
    if (frames.length > MAX_FRAMES) {
      console.warn(`[AIAnalysisService] Frame count (${frames.length}) exceeds maximum (${MAX_FRAMES}). Using first ${MAX_FRAMES} frames.`);
      frames = frames.slice(0, MAX_FRAMES);
    }

    // Calculate initial payload size
    let base64Frames = frames.map(frame => frame.toString('base64'));
    let payloadSize = JSON.stringify({ frames: base64Frames, sensorData }).length;
    let payloadSizeMB = payloadSize / (1024 * 1024);
    
    console.log(`[AIAnalysisService] Initial payload size: ${payloadSizeMB.toFixed(2)} MB for ${frames.length} frames`);

    // Compress frames if payload is too large or close to limit
    if (payloadSizeMB > MAX_PAYLOAD_MB || payloadSizeMB > WARNING_PAYLOAD_MB) {
      console.log(`[AIAnalysisService] Payload size (${payloadSizeMB.toFixed(2)} MB) exceeds warning threshold, compressing frames...`);
      
      // Progressive compression: start with high quality, reduce if needed
      let compressionAttempts = 0;
      const maxCompressionAttempts = 3;
      let compressedFrames = frames;
      
      while (payloadSizeMB > TARGET_PAYLOAD_MB && compressionAttempts < maxCompressionAttempts) {
        compressionAttempts++;
        
        // Reduce dimensions and quality progressively
        let targetWidth = 1920;
        let targetHeight = 1080;
        let quality = 85;
        
        if (compressionAttempts === 1) {
          // First attempt: resize to 1920x1080, quality 85%
          targetWidth = 1920;
          targetHeight = 1080;
          quality = 85;
        } else if (compressionAttempts === 2) {
          // Second attempt: resize to 1280x720, quality 80%
          targetWidth = 1280;
          targetHeight = 720;
          quality = 80;
          console.log(`[AIAnalysisService] Compression attempt ${compressionAttempts}: Reducing to ${targetWidth}x${targetHeight}, quality ${quality}%`);
        } else {
          // Third attempt: resize to 960x540, quality 75%
          targetWidth = 960;
          targetHeight = 540;
          quality = 75;
          console.log(`[AIAnalysisService] Compression attempt ${compressionAttempts}: Further reducing to ${targetWidth}x${targetHeight}, quality ${quality}%`);
        }
        
        compressedFrames = await this.compressFrames(compressedFrames, targetWidth, targetHeight, quality);
        
        // Recalculate payload size
        base64Frames = compressedFrames.map(frame => frame.toString('base64'));
        payloadSize = JSON.stringify({ frames: base64Frames, sensorData }).length;
        payloadSizeMB = payloadSize / (1024 * 1024);
        
        console.log(`[AIAnalysisService] After compression attempt ${compressionAttempts}: ${payloadSizeMB.toFixed(2)} MB`);
      }
      
      // Update frames to compressed version
      frames = compressedFrames;
      
      if (payloadSizeMB > MAX_PAYLOAD_MB) {
        console.warn(`[AIAnalysisService] WARNING: Payload still large (${payloadSizeMB.toFixed(2)} MB) after compression, but proceeding...`);
      } else {
        console.log(`[AIAnalysisService] ✓ Compression successful: Reduced to ${payloadSizeMB.toFixed(2)} MB`);
      }
    } else {
      console.log(`[AIAnalysisService] Payload size acceptable (${payloadSizeMB.toFixed(2)} MB), no compression needed`);
    }

    // Warn if payload is large but still acceptable
    if (payloadSizeMB > WARNING_PAYLOAD_MB) {
      console.warn(`[AIAnalysisService] WARNING: Large payload (${payloadSizeMB.toFixed(2)} MB). This may cause memory issues.`);
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

