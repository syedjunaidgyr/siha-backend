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

const DEFAULT_AI_BASE_URL = 'http://13.203.161.24:3001/api';

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
          // Use failOn: 'none' to ignore JPEG warnings (like SOS parameters)
          // This allows us to process corrupted/problematic JPEG files
          const image = sharp(frame, { 
            failOn: 'none', // Don't fail on warnings
            limitInputPixels: 268402689 // Allow very large images
          });
          
          const metadata = await image.metadata();
          
          if (!metadata.width || !metadata.height) {
            console.warn(`[AIAnalysisService] Frame ${index + 1}: Could not read dimensions, recompressing only`);
            // Force re-encode through PNG to avoid JPEG issues
            return await image
              .png()
              .jpeg({ 
                quality, 
                mozjpeg: false, // Use standard JPEG encoder for better compatibility
                progressive: false // Avoid progressive issues
              })
              .toBuffer();
          }
          
          // Always resize to target dimensions (maintaining aspect ratio) for consistent compression
          const ratio = Math.min(
            targetMaxWidth / metadata.width,
            targetMaxHeight / metadata.height
          );
          const newWidth = Math.round(metadata.width * ratio);
          const newHeight = Math.round(metadata.height * ratio);
          
          // Only log if dimensions actually changed
          if (newWidth !== metadata.width || newHeight !== metadata.height) {
            console.log(`[AIAnalysisService] Frame ${index + 1}: Resizing from ${metadata.width}x${metadata.height} to ${newWidth}x${newHeight}`);
          } else {
            console.log(`[AIAnalysisService] Frame ${index + 1}: Keeping dimensions ${metadata.width}x${metadata.height}, reducing quality to ${quality}%`);
          }
          
          // Try direct JPEG compression first
          try {
            return await image
              .resize(newWidth, newHeight, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ 
                quality, 
                mozjpeg: false, // Use standard JPEG to avoid SOS parameter issues
                progressive: false, // Disable progressive to avoid issues
              })
              .toBuffer();
          } catch (jpegError: any) {
            // If JPEG compression fails, convert through PNG first (more tolerant)
            console.log(`[AIAnalysisService] Frame ${index + 1}: Direct JPEG failed, using PNG intermediate conversion`);
            return await image
              .resize(newWidth, newHeight, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .png() // Convert to PNG first to clean up any JPEG issues
              .jpeg({ 
                quality, 
                mozjpeg: false,
                progressive: false,
              })
              .toBuffer();
          }
        } catch (error: any) {
          // Last resort: try to just resize without recompressing
          console.warn(`[AIAnalysisService] Frame ${index + 1}: Compression failed (${error.message}), attempting basic resize`);
          try {
            const image = sharp(frame, { failOn: 'none', limitInputPixels: 268402689 });
            const metadata = await image.metadata();
            if (metadata.width && metadata.height) {
              const ratio = Math.min(
                targetMaxWidth / metadata.width,
                targetMaxHeight / metadata.height
              );
              const newWidth = Math.round(metadata.width * ratio);
              const newHeight = Math.round(metadata.height * ratio);
              
              // Force resize to very small dimensions and low quality if all else fails
              const forceWidth = Math.min(newWidth, 480);
              const forceHeight = Math.min(newHeight, 360);
              const forceQuality = Math.max(quality - 15, 60); // Lower quality as fallback
              
              console.log(`[AIAnalysisService] Frame ${index + 1}: Using aggressive fallback resize to ${forceWidth}x${forceHeight} @ ${forceQuality}%`);
              
              // Force through PNG to clean up JPEG issues, then resize and compress
              return await image
                .png() // Convert to PNG first
                .resize(forceWidth, forceHeight, {
                  fit: 'inside',
                  withoutEnlargement: true,
                })
                .jpeg({ 
                  quality: forceQuality, 
                  mozjpeg: false, 
                  progressive: false 
                })
                .toBuffer();
            }
          } catch (fallbackError: any) {
            console.error(`[AIAnalysisService] Frame ${index + 1}: All compression methods failed: ${fallbackError.message}`);
            
            // Last desperate attempt: force to tiny image
            try {
              const image = sharp(frame, { failOn: 'none' });
              return await image
                .resize(320, 240, { fit: 'inside', withoutEnlargement: false })
                .jpeg({ quality: 60, mozjpeg: false })
                .toBuffer();
            } catch (finalError: any) {
              // This should never happen, but if it does, we need to fail the whole request
              console.error(`[AIAnalysisService] Frame ${index + 1}: CRITICAL - Could not compress frame at all. Original size: ${(frame.length / 1024).toFixed(2)} KB`);
              throw new Error(`Failed to compress frame ${index + 1}: ${finalError.message}`);
            }
          }
          // This should never be reached due to throw above
          throw new Error(`Failed to compress frame ${index + 1} after all attempts`);
        }
      })
    );
    
    return compressedFrames;
  }

  static async analyzeVideoFrames(frames: Buffer[], sensorData?: any, userProfile?: any): Promise<FaceAnalysisResult> {
    if (!frames || frames.length === 0) {
      throw new Error('No frames provided for analysis');
    }

    // Limit frame count to prevent memory issues (max 12 frames for safety)
    const MAX_FRAMES = 12;
    const MAX_PAYLOAD_MB = 20; // Maximum payload size in MB (hard limit)
    const COMPRESSION_THRESHOLD_MB = 10; // Start compressing if payload exceeds this (lower threshold)
    const TARGET_PAYLOAD_MB = 10; // Target size after compression (more aggressive)
    
    if (frames.length > MAX_FRAMES) {
      console.warn(`[AIAnalysisService] Frame count (${frames.length}) exceeds maximum (${MAX_FRAMES}). Using first ${MAX_FRAMES} frames.`);
      frames = frames.slice(0, MAX_FRAMES);
    }

    // Calculate initial payload size
    let base64Frames = frames.map(frame => frame.toString('base64'));
    let payloadSize = JSON.stringify({ frames: base64Frames, sensorData }).length;
    let payloadSizeMB = payloadSize / (1024 * 1024);
    
    console.log(`[AIAnalysisService] Initial payload size: ${payloadSizeMB.toFixed(2)} MB for ${frames.length} frames`);

    // ALWAYS compress frames if payload is above threshold - mandatory compression
    // This ensures we reduce payload size even for problematic JPEGs
    if (payloadSizeMB > COMPRESSION_THRESHOLD_MB) {
      console.log(`[AIAnalysisService] Payload size (${payloadSizeMB.toFixed(2)} MB) exceeds threshold (${COMPRESSION_THRESHOLD_MB} MB), compressing frames...`);
      
      // Progressive compression: start more aggressively and reduce further if needed
      let compressionAttempts = 0;
      const maxCompressionAttempts = 4; // Increased attempts
      let compressedFrames = frames;
      const initialPayloadSizeMB = payloadSizeMB;
      
      // Determine starting compression level based on initial size
      // Start more aggressively to handle large files
      let startLevel = 2; // Default to moderate compression (960x540)
      if (payloadSizeMB > 25) {
        startLevel = 3; // Start with very aggressive compression for huge payloads
      } else if (payloadSizeMB > 18) {
        startLevel = 3; // Also use aggressive for large payloads
      } else if (payloadSizeMB > 15) {
        startLevel = 2; // Use moderate compression
      }
      
      while (payloadSizeMB > TARGET_PAYLOAD_MB && compressionAttempts < maxCompressionAttempts) {
        compressionAttempts++;

        // Reduce dimensions and quality progressively
        let targetWidth = 1920;
        let targetHeight = 1080;
        let quality = 85;
        
        // Start from determined level or current attempt
        const currentLevel = compressionAttempts === 1 ? startLevel : compressionAttempts;
        
        if (currentLevel === 1) {
          // First attempt: resize to 1280x720, quality 80% (more aggressive start)
          targetWidth = 1280;
          targetHeight = 720;
          quality = 80;
        } else if (currentLevel === 2) {
          // Second attempt: resize to 960x540, quality 75%
          targetWidth = 960;
          targetHeight = 540;
          quality = 75;
        } else if (currentLevel === 3) {
          // Third attempt: resize to 640x360, quality 70%
          targetWidth = 640;
          targetHeight = 360;
          quality = 70;
        } else {
          // Fourth attempt: resize to 480x270, quality 65% (very aggressive)
          targetWidth = 480;
          targetHeight = 270;
          quality = 65;
        }
        
        console.log(`[AIAnalysisService] Compression attempt ${compressionAttempts}: Resizing to ${targetWidth}x${targetHeight}, quality ${quality}%`);
        
        const framesBeforeCompression = compressedFrames.slice(); // Copy for comparison
        compressedFrames = await this.compressFrames(compressedFrames, targetWidth, targetHeight, quality);
        
        // Verify compression actually reduced size - check individual frame sizes
        let totalCompressedSize = 0;
        let totalOriginalSize = 0;
        for (let i = 0; i < compressedFrames.length; i++) {
          totalCompressedSize += compressedFrames[i].length;
          totalOriginalSize += framesBeforeCompression[i]?.length || 0;
        }
        const compressionRatio = totalOriginalSize > 0 ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100 : 0;
        console.log(`[AIAnalysisService] Compression ratio: ${compressionRatio.toFixed(1)}% (${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB → ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB)`);
        
        // If compression didn't help (ratio < 10%), we have serious issues - reduce frames and try again
        if (compressionRatio < 10 && compressionAttempts >= 2) {
          if (compressedFrames.length > 6) {
            console.warn(`[AIAnalysisService] Compression ineffective (${compressionRatio.toFixed(1)}% reduction), reducing frame count to 6`);
            compressedFrames = compressedFrames.slice(0, 6);
          }
        }
        
        // Ensure we actually got smaller frames
        if (totalCompressedSize >= totalOriginalSize * 0.95 && compressionAttempts < maxCompressionAttempts) {
          console.warn(`[AIAnalysisService] Compression barely effective, trying more aggressive settings next attempt`);
        }
        
        // Recalculate payload size
        base64Frames = compressedFrames.map(frame => frame.toString('base64'));
        payloadSize = JSON.stringify({ frames: base64Frames, sensorData }).length;
        payloadSizeMB = payloadSize / (1024 * 1024);
        
        console.log(`[AIAnalysisService] After compression attempt ${compressionAttempts}: ${payloadSizeMB.toFixed(2)} MB (reduced from ${initialPayloadSizeMB.toFixed(2)} MB)`);
        
        // If we've reduced significantly and still above target, continue
        if (payloadSizeMB <= TARGET_PAYLOAD_MB) {
          break;
        }
        
        // If we're still very large and have frames to spare, reduce earlier
        if (payloadSizeMB > 18 && compressedFrames.length > 6 && compressionAttempts >= 2) {
          console.warn(`[AIAnalysisService] Payload still very large, reducing to 6 frames`);
          compressedFrames = compressedFrames.slice(0, 6);
        }
      }
      
      // Update frames to compressed version
      frames = compressedFrames;
      
      // If still too large after compression, aggressively reduce frame count
      if (payloadSizeMB > MAX_PAYLOAD_MB) {
        // More aggressive frame reduction based on payload size
        let targetFrameCount = 8;
        if (payloadSizeMB > 30) {
          targetFrameCount = 6; // Very aggressive for huge payloads
        } else if (payloadSizeMB > 25) {
          targetFrameCount = 6;
        } else if (payloadSizeMB > 20) {
          targetFrameCount = 8;
        }
        
        if (compressedFrames.length > targetFrameCount) {
          console.warn(`[AIAnalysisService] Payload (${payloadSizeMB.toFixed(2)} MB) still too large after compression. Reducing frame count from ${compressedFrames.length} to ${targetFrameCount} frames.`);
          compressedFrames = compressedFrames.slice(0, targetFrameCount);
          frames = compressedFrames;
          
          // Recalculate payload size
          base64Frames = compressedFrames.map(frame => frame.toString('base64'));
          payloadSize = JSON.stringify({ frames: base64Frames, sensorData }).length;
          payloadSizeMB = payloadSize / (1024 * 1024);
          console.log(`[AIAnalysisService] After reducing frame count: ${payloadSizeMB.toFixed(2)} MB for ${compressedFrames.length} frames`);
        }
      } else if (payloadSizeMB > 15 && compressedFrames.length > 8) {
        // Also reduce if still large but within limit
        console.warn(`[AIAnalysisService] Payload (${payloadSizeMB.toFixed(2)} MB) still large. Reducing to 8 frames for safety.`);
        compressedFrames = compressedFrames.slice(0, 8);
        frames = compressedFrames;
        
        // Recalculate payload size
        base64Frames = compressedFrames.map(frame => frame.toString('base64'));
        payloadSize = JSON.stringify({ frames: base64Frames, sensorData }).length;
        payloadSizeMB = payloadSize / (1024 * 1024);
        console.log(`[AIAnalysisService] After safety frame reduction: ${payloadSizeMB.toFixed(2)} MB for ${compressedFrames.length} frames`);
      }
      
      if (payloadSizeMB > MAX_PAYLOAD_MB) {
        const errorMsg = `Payload too large (${payloadSizeMB.toFixed(2)} MB) after compression. Maximum allowed: ${MAX_PAYLOAD_MB} MB.`;
        console.error(`[AIAnalysisService] ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      } else if (payloadSizeMB > TARGET_PAYLOAD_MB) {
        console.warn(`[AIAnalysisService] WARNING: Payload (${payloadSizeMB.toFixed(2)} MB) still above target (${TARGET_PAYLOAD_MB} MB) after compression, but within limit.`);
      } else {
        console.log(`[AIAnalysisService] ✓ Compression successful: Reduced from ${initialPayloadSizeMB.toFixed(2)} MB to ${payloadSizeMB.toFixed(2)} MB`);
      }
    } else {
      console.log(`[AIAnalysisService] Payload size acceptable (${payloadSizeMB.toFixed(2)} MB), no compression needed`);
    }

    const payload: Record<string, any> = {
      frames: base64Frames,
    };

    if (sensorData) {
      payload.sensorData = sensorData;
    }
    
    // Add user profile for calibration and personalized baselines
    if (userProfile) {
      payload.userProfile = userProfile;
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
      // Enhanced error logging
      console.error('[AIAnalysisService] Python AI analyze-video error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      });
      
      // Provide more specific error messages
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Video analysis timed out. The payload may be too large. Try reducing the number of frames.');
      }
      if (error.code === 'ECONNRESET' || error.message?.includes('socket hang up')) {
        throw new Error('Connection to AI service was reset. The payload may be too large or the service may have crashed. Try reducing the number of frames.');
      }
      
      // Log the actual error from AI service if available
      if (error.response?.data?.error || error.response?.data?.message) {
        const aiError = error.response.data.error || error.response.data.message;
        console.error('[AIAnalysisService] AI service error details:', aiError);
        throw new Error(`Video analysis failed: ${aiError}`);
      }
      
      throw this.mapError(error, 'Video analysis failed');
    }
  }

  /**
   * Analyze a video file for vital signs
   * Sends the video file directly to Python AI service for processing
   */
  static async analyzeVideoFile(
    videoBuffer: Buffer,
    mimeType: string,
    sensorData?: any,
    userProfile?: any
  ): Promise<FaceAnalysisResult> {
    if (!videoBuffer || videoBuffer.length === 0) {
      throw new Error('Video buffer is required');
    }

    console.log(`[AIAnalysisService] Analyzing video file: ${videoBuffer.length} bytes, type: ${mimeType}`);

    const payload: Record<string, any> = {
      video: videoBuffer.toString('base64'),
      mimeType: mimeType,
    };

    if (sensorData) {
      payload.sensorData = sensorData;
    }

    if (userProfile) {
      payload.userProfile = userProfile;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/ai/analyze-video-file`,
        payload,
        { 
          timeout: 180_000, // 3 minutes for video processing
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || 'Video analysis failed');
      }

      return response.data.result;
    } catch (error: any) {
      console.error('[AIAnalysisService] Python AI analyze-video-file error:', error?.response?.data || error.message);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('Video analysis timed out. The video file may be too large or processing took too long.');
      }
      
      if (error.response?.data?.error) {
        const aiError = error.response.data.error;
        throw new Error(`Video analysis failed: ${aiError}`);
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

