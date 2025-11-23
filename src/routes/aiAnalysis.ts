import { Router, Response } from 'express';
import multer from 'multer';
import { body, query, validationResult } from 'express-validator';
import { AIAnalysisService } from '../services/aiAnalysisService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { MetricService } from '../services/metricService';
import { S3Service } from '../services/s3Service';
import { ProfileService } from '../services/profileService';
import { PreventiveHealthService } from '../services/preventiveHealthService';
import User from '../models/User';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const router = Router();

// Configure multer for memory storage (we'll process images in memory)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Configure multer for video file uploads
// Use disk storage instead of memory to avoid loading large files into RAM
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Store in system temp directory
      const tempDir = os.tmpdir();
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `vitals-video-${uniqueSuffix}.mp4`);
    },
  }),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150MB limit for video files
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

const parseSensorData = (raw: any) => {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse sensorData JSON:', error);
      return undefined;
    }
  }
  return raw;
};

/**
 * POST /v1/ai/analyze-image
 * Analyze a single image frame for vital signs
 */
router.post(
  '/analyze-image',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const sensorData = parseSensorData(req.body.sensorData);

      // Analyze the image
      const result = await AIAnalysisService.analyzeImageFrame(req.file.buffer, sensorData);

      // Optionally save to database if requested
      const saveToDatabase = req.body.save === 'true' || req.body.save === true;
      
      if (saveToDatabase && result.faceDetected && result.vitals) {
        const timestamp = result.vitals.timestamp || new Date();
        const metrics: any[] = [];

        // Minimum confidence threshold for saving metrics (0.5 = 50%)
        const MIN_CONFIDENCE = 0.5;
        const confidence = typeof result.vitals.confidence === 'string' 
          ? parseFloat(result.vitals.confidence) 
          : result.vitals.confidence;

        // Helper function to validate if a metric should be saved
        const shouldSaveMetric = (value: any): boolean => {
          // Don't save if value is null, undefined, or 0 (invalid)
          if (value === null || value === undefined || value === 0) {
            return false;
          }
          
          // Don't save if confidence is too low (fallback scenario)
          if (confidence !== undefined && confidence < MIN_CONFIDENCE) {
            console.warn(`[AI Analysis] Skipping metric with low confidence: ${confidence} < ${MIN_CONFIDENCE}`);
            return false;
          }
          
          return true;
        };

        if (result.vitals.heartRate !== undefined && shouldSaveMetric(result.vitals.heartRate)) {
          metrics.push({
            metric_type: 'heart_rate',
            value: result.vitals.heartRate,
            unit: 'bpm',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.stressLevel !== undefined && shouldSaveMetric(result.vitals.stressLevel)) {
          metrics.push({
            metric_type: 'stress_level',
            value: result.vitals.stressLevel,
            unit: 'score',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.oxygenSaturation !== undefined && shouldSaveMetric(result.vitals.oxygenSaturation)) {
          metrics.push({
            metric_type: 'oxygen_saturation',
            value: result.vitals.oxygenSaturation,
            unit: '%',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.respiratoryRate !== undefined && shouldSaveMetric(result.vitals.respiratoryRate)) {
          metrics.push({
            metric_type: 'respiratory_rate',
            value: result.vitals.respiratoryRate,
            unit: 'breaths/min',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.temperature !== undefined && shouldSaveMetric(result.vitals.temperature)) {
          metrics.push({
            metric_type: 'temperature',
            value: result.vitals.temperature,
            unit: '°C',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.bloodPressure !== undefined) {
          // Save systolic BP only if valid
          if (result.vitals.bloodPressure.systolic !== undefined && shouldSaveMetric(result.vitals.bloodPressure.systolic)) {
            metrics.push({
              metric_type: 'blood_pressure_systolic',
              value: result.vitals.bloodPressure.systolic,
              unit: 'mmHg',
              start_time: timestamp,
              source: 'ai_face_analysis',
              confidence: result.vitals.confidence,
            });
          }
          // Save diastolic BP only if valid
          if (result.vitals.bloodPressure.diastolic !== undefined && shouldSaveMetric(result.vitals.bloodPressure.diastolic)) {
            metrics.push({
              metric_type: 'blood_pressure_diastolic',
              value: result.vitals.bloodPressure.diastolic,
              unit: 'mmHg',
              start_time: timestamp,
              source: 'ai_face_analysis',
              confidence: result.vitals.confidence,
            });
          }
        }

        if (metrics.length > 0) {
          await MetricService.createBatchMetrics(req.user.id, metrics);
        } else {
          console.warn('[AI Analysis] No metrics to save - all vital signs were filtered out (low confidence or invalid values)');
        }
      }

      res.json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.error('AI analysis error:', error);
      res.status(500).json({
        error: 'Analysis failed',
        message: error.message,
      });
    }
  }
);

/**
 * GET /v1/ai/upload-urls
 * Get presigned S3 URLs for uploading video frames
 */
router.get(
  '/upload-urls',
  authenticate,
  [
    query('frameCount').optional().isInt({ min: 1, max: 100 }).withMessage('frameCount must be between 1 and 100'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const frameCount = parseInt(req.query.frameCount as string) || 15;
      console.log(`[AI Analysis] Generating ${frameCount} S3 upload URLs for user ${req.user.id}`);
      
      const uploadInfos = await S3Service.getBatchUploadUrls(req.user.id, frameCount);
      
      console.log(`[AI Analysis] Generated ${uploadInfos.length} S3 upload URLs`);
      if (uploadInfos.length > 0) {
        console.log(`[AI Analysis] Sample URL format: ${uploadInfos[0].uploadUrl.substring(0, 100)}...`);
      }

      res.json({
        uploadUrls: uploadInfos,
        frameCount: uploadInfos.length,
      });
    } catch (error: any) {
      console.error('Error generating upload URLs:', error);
      res.status(500).json({ error: 'Failed to generate upload URLs', message: error.message });
    }
  }
);

/**
 * GET /v1/ai/video-upload-url
 * Get presigned S3 URL for uploading a video file
 */
router.get(
  '/video-upload-url',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log(`[AI Analysis] Generating video upload URL for user ${req.user.id}`);
      
      const uploadInfo = await S3Service.getVideoUploadUrl(req.user.id);
      
      console.log(`[AI Analysis] Generated video upload URL: ${uploadInfo.key}`);

      res.json({
        uploadUrl: uploadInfo.uploadUrl,
        key: uploadInfo.key,
      });
    } catch (error: any) {
      console.error('Error generating video upload URL:', error);
      res.status(500).json({ error: 'Failed to generate video upload URL', message: error.message });
    }
  }
);

/**
 * POST /v1/ai/analyze-video
 * Analyze multiple frames (video sequence) for vital signs
 * Accepts S3 keys (preferred), multiple image files, or base64 encoded images
 */
router.post(
  '/analyze-video',
  authenticate,
  upload.array('frames', 100), // Max 100 frames
  [
    body('frames').optional().isArray(),
    body('s3Keys').optional().isArray(),
    body('save').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get frames from S3 keys, uploaded files, or base64 data
      let frames: Buffer[] = [];
      let s3Keys: string[] = [];

      // Option 1: S3 keys (preferred for large payloads)
      if (req.body.s3Keys && Array.isArray(req.body.s3Keys) && req.body.s3Keys.length > 0) {
        console.log(`[AI Analysis] Downloading ${req.body.s3Keys.length} frames from S3`);
        s3Keys = req.body.s3Keys;
        frames = await S3Service.downloadFrames(s3Keys);
        console.log(`[AI Analysis] Downloaded ${frames.length} frames from S3`);
      }
      // Option 2: Uploaded files
      else if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        frames = (req.files as Express.Multer.File[]).map(file => file.buffer);
      }
      // Option 3: Base64 encoded images (fallback, not recommended for large payloads)
      else if (req.body.frames && Array.isArray(req.body.frames)) {
        console.log('[AI Analysis] Using base64 frames (consider using S3 for large payloads)');
        frames = req.body.frames.map((frame: string) => {
          // Remove data URL prefix if present
          const base64Data = frame.replace(/^data:image\/\w+;base64,/, '');
          return Buffer.from(base64Data, 'base64');
        });
      } else {
        return res.status(400).json({ error: 'No frames provided. Use s3Keys, files, or frames array.' });
      }

      if (frames.length === 0) {
        return res.status(400).json({ error: 'No valid frames found' });
      }

      // Analyze the frames
      const sensorData = parseSensorData(req.body.sensorData);
      
      // Get user profile for calibration and personalized baselines
      let userProfile: any = undefined;
      try {
        const user = await User.findByPk(req.user.id);
        if (user) {
          userProfile = PreventiveHealthService.buildUserProfilePayload(user);
          console.log(`[AI Analysis] User profile loaded for calibration: age=${userProfile?.age}, gender=${userProfile?.gender}`);
        }
      } catch (profileError: any) {
        console.warn(`[AI Analysis] Could not load user profile: ${profileError.message}. Continuing without user profile.`);
        // Continue without user profile - calibration will use defaults
      }
      
      let result: any;
      
      try {
        result = await AIAnalysisService.analyzeVideoFrames(frames, sensorData, userProfile);
      } finally {
        // Clean up S3 objects after processing (async, don't wait)
        if (s3Keys.length > 0) {
          S3Service.deleteFrames(s3Keys).catch((err) => {
            console.error('Error cleaning up S3 frames:', err);
          });
        }
      }

      // Optionally save to database
      const saveToDatabase = req.body.save === true || req.body.save === 'true';
      
      if (saveToDatabase && result.faceDetected && result.vitals) {
        const timestamp = result.vitals.timestamp || new Date();
        const metrics: any[] = [];

        // Minimum confidence threshold for saving metrics (0.5 = 50%)
        const MIN_CONFIDENCE = 0.5;
        const confidence = typeof result.vitals.confidence === 'string' 
          ? parseFloat(result.vitals.confidence) 
          : result.vitals.confidence;

        // Helper function to validate if a metric should be saved
        const shouldSaveMetric = (value: any): boolean => {
          // Don't save if value is null, undefined, or 0 (invalid)
          if (value === null || value === undefined || value === 0) {
            return false;
          }
          
          // Don't save if confidence is too low (fallback scenario)
          if (confidence !== undefined && confidence < MIN_CONFIDENCE) {
            console.warn(`[AI Analysis] Skipping metric with low confidence: ${confidence} < ${MIN_CONFIDENCE}`);
            return false;
          }
          
          return true;
        };

        if (result.vitals.heartRate !== undefined && shouldSaveMetric(result.vitals.heartRate)) {
          metrics.push({
            metric_type: 'heart_rate',
            value: result.vitals.heartRate,
            unit: 'bpm',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.stressLevel !== undefined && shouldSaveMetric(result.vitals.stressLevel)) {
          metrics.push({
            metric_type: 'stress_level',
            value: result.vitals.stressLevel,
            unit: 'score',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.oxygenSaturation !== undefined && shouldSaveMetric(result.vitals.oxygenSaturation)) {
          metrics.push({
            metric_type: 'oxygen_saturation',
            value: result.vitals.oxygenSaturation,
            unit: '%',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.respiratoryRate !== undefined && shouldSaveMetric(result.vitals.respiratoryRate)) {
          metrics.push({
            metric_type: 'respiratory_rate',
            value: result.vitals.respiratoryRate,
            unit: 'breaths/min',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.temperature !== undefined && shouldSaveMetric(result.vitals.temperature)) {
          metrics.push({
            metric_type: 'temperature',
            value: result.vitals.temperature,
            unit: '°C',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.bloodPressure !== undefined) {
          // Save systolic BP only if valid
          if (result.vitals.bloodPressure.systolic !== undefined && shouldSaveMetric(result.vitals.bloodPressure.systolic)) {
            metrics.push({
              metric_type: 'blood_pressure_systolic',
              value: result.vitals.bloodPressure.systolic,
              unit: 'mmHg',
              start_time: timestamp,
              source: 'ai_face_analysis',
              confidence: result.vitals.confidence,
            });
          }
          // Save diastolic BP only if valid
          if (result.vitals.bloodPressure.diastolic !== undefined && shouldSaveMetric(result.vitals.bloodPressure.diastolic)) {
            metrics.push({
              metric_type: 'blood_pressure_diastolic',
              value: result.vitals.bloodPressure.diastolic,
              unit: 'mmHg',
              start_time: timestamp,
              source: 'ai_face_analysis',
              confidence: result.vitals.confidence,
            });
          }
        }

        if (metrics.length > 0) {
          await MetricService.createBatchMetrics(req.user.id, metrics);
        } else {
          console.warn('[AI Analysis] No metrics to save - all vital signs were filtered out (low confidence or invalid values)');
        }
      }

      res.json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.error('[AI Analysis Route] Video analysis error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      res.status(500).json({
        error: 'Analysis failed',
        message: error.message || 'Unknown error occurred during video analysis',
      });
    }
  }
);

/**
 * POST /v1/ai/analyze-video-file
 * Analyze a video file for vital signs (video-based pipeline)
 * Accepts either S3 key (preferred) or multipart file upload
 */
router.post(
  '/analyze-video-file',
  authenticate,
  videoUpload.single('video'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const sensorData = parseSensorData(req.body.sensorData);
      let userProfile = req.body.userProfile 
        ? (typeof req.body.userProfile === 'string' ? JSON.parse(req.body.userProfile) : req.body.userProfile)
        : undefined;

      // Get user profile if not provided
      if (!userProfile) {
        try {
          const profile = await ProfileService.getProfile(req.user.id);
          if (profile) {
            // Calculate age from date_of_birth
            let age: number | undefined;
            if (profile.date_of_birth) {
              const dob = profile.date_of_birth instanceof Date 
                ? profile.date_of_birth 
                : new Date(profile.date_of_birth);
              const diffMs = Date.now() - dob.getTime();
              age = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
            }
            
            userProfile = {
              age: age,
              gender: profile.gender,
            };
          }
        } catch (error) {
          console.warn('[AI Analysis] Could not load user profile:', error);
        }
      }

      let videoBuffer: Buffer;
      let mimeType: string = 'video/mp4';

      // Option 1: S3 key (preferred for large files)
      if (req.body.s3Key && typeof req.body.s3Key === 'string') {
        console.log(`[AI Analysis] Downloading video from S3: ${req.body.s3Key}`);
        videoBuffer = await S3Service.downloadVideo(req.body.s3Key);
        console.log(`[AI Analysis] Video downloaded from S3: ${videoBuffer.length} bytes`);
      } 
      // Option 2: Multipart file upload
      else if (req.file) {
        const uploadedFile = req.file;
        console.log(`[AI Analysis] Video file received: ${uploadedFile.size} bytes, type: ${uploadedFile.mimetype}, path: ${uploadedFile.path}`);
        
        // Read file from disk instead of using buffer (avoids memory issues with large files)
        // When using diskStorage, req.file.buffer is undefined, we need to read from path
        const filePath = uploadedFile.path;
        if (!filePath) {
          return res.status(400).json({ error: 'File path not available' });
        }
        
        try {
          videoBuffer = await fs.promises.readFile(filePath);
          mimeType = uploadedFile.mimetype;
          
          // Clean up temp file after reading (async, don't wait)
          fs.unlink(filePath, (err) => {
            if (err) console.warn(`[AI Analysis] Could not delete temp file ${filePath}:`, err);
          });
        } catch (readError: any) {
          // Clean up temp file on error
          if (filePath) {
            fs.unlink(filePath, () => {});
          }
          throw new Error(`Failed to read video file: ${readError?.message || 'Unknown error'}`);
        }
      } 
      else {
        return res.status(400).json({ error: 'No video file provided. Use s3Key or upload a file.' });
      }

      // Analyze video file
      const result = await AIAnalysisService.analyzeVideoFile(
        videoBuffer,
        mimeType,
        sensorData,
        userProfile
      );

      // Clean up S3 video after processing (async, don't wait)
      if (req.body.s3Key) {
        S3Service.deleteVideo(req.body.s3Key).catch((err) => {
          console.error('Error cleaning up S3 video:', err);
        });
      }

      // Save to database if requested
      const saveToDatabase = req.body.save === 'true' || req.body.save === true;
      
      if (saveToDatabase && result.faceDetected && result.vitals) {
        const timestamp = result.vitals.timestamp || new Date();
        const metrics: any[] = [];

        const MIN_CONFIDENCE = 0.5;
        const confidence = typeof result.vitals.confidence === 'string' 
          ? parseFloat(result.vitals.confidence) 
          : result.vitals.confidence;

        const shouldSaveMetric = (value: any): boolean => {
          if (value === null || value === undefined || value === 0) {
            return false;
          }
          if (confidence !== undefined && confidence < MIN_CONFIDENCE) {
            return false;
          }
          return true;
        };

        if (result.vitals.heartRate !== undefined && shouldSaveMetric(result.vitals.heartRate)) {
          metrics.push({
            metric_type: 'heart_rate',
            value: result.vitals.heartRate,
            unit: 'bpm',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: confidence,
          });
        }

        if (result.vitals.stressLevel !== undefined && shouldSaveMetric(result.vitals.stressLevel)) {
          metrics.push({
            metric_type: 'stress_level',
            value: result.vitals.stressLevel,
            unit: 'score',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: confidence,
          });
        }

        if (result.vitals.oxygenSaturation !== undefined && shouldSaveMetric(result.vitals.oxygenSaturation)) {
          metrics.push({
            metric_type: 'oxygen_saturation',
            value: result.vitals.oxygenSaturation,
            unit: '%',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: confidence,
          });
        }

        if (result.vitals.respiratoryRate !== undefined && shouldSaveMetric(result.vitals.respiratoryRate)) {
          metrics.push({
            metric_type: 'respiratory_rate',
            value: result.vitals.respiratoryRate,
            unit: 'breaths/min',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: confidence,
          });
        }

        if (result.vitals.temperature !== undefined && shouldSaveMetric(result.vitals.temperature)) {
          metrics.push({
            metric_type: 'temperature',
            value: result.vitals.temperature,
            unit: '°C',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: confidence,
          });
        }

        if (result.vitals.bloodPressure !== undefined) {
          if (result.vitals.bloodPressure.systolic !== undefined && shouldSaveMetric(result.vitals.bloodPressure.systolic)) {
            metrics.push({
              metric_type: 'blood_pressure_systolic',
              value: result.vitals.bloodPressure.systolic,
              unit: 'mmHg',
              start_time: timestamp,
              source: 'ai_face_analysis',
              confidence: confidence,
            });
          }
          if (result.vitals.bloodPressure.diastolic !== undefined && shouldSaveMetric(result.vitals.bloodPressure.diastolic)) {
            metrics.push({
              metric_type: 'blood_pressure_diastolic',
              value: result.vitals.bloodPressure.diastolic,
              unit: 'mmHg',
              start_time: timestamp,
              source: 'ai_face_analysis',
              confidence: confidence,
            });
          }
        }

        if (metrics.length > 0) {
          await MetricService.createBatchMetrics(req.user.id, metrics);
        }
      }

      res.json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.error('[AI Analysis Route] Video file analysis error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      res.status(500).json({
        error: 'Analysis failed',
        message: error.message || 'Unknown error occurred during video file analysis',
      });
    }
  }
);

export default router;

