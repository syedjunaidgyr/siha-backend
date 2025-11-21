import { Router, Response } from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { AIAnalysisService } from '../services/aiAnalysisService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { MetricService } from '../services/metricService';

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

        if (result.vitals.heartRate !== undefined) {
          metrics.push({
            metric_type: 'heart_rate',
            value: result.vitals.heartRate,
            unit: 'bpm',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.stressLevel !== undefined) {
          metrics.push({
            metric_type: 'stress_level',
            value: result.vitals.stressLevel,
            unit: 'score',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.oxygenSaturation !== undefined) {
          metrics.push({
            metric_type: 'oxygen_saturation',
            value: result.vitals.oxygenSaturation,
            unit: '%',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.respiratoryRate !== undefined) {
          metrics.push({
            metric_type: 'respiratory_rate',
            value: result.vitals.respiratoryRate,
            unit: 'breaths/min',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.temperature !== undefined) {
          metrics.push({
            metric_type: 'temperature',
            value: result.vitals.temperature,
            unit: '°C',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
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
      console.error('AI analysis error:', error);
      res.status(500).json({
        error: 'Analysis failed',
        message: error.message,
      });
    }
  }
);

/**
 * POST /v1/ai/analyze-video
 * Analyze multiple frames (video sequence) for vital signs
 * Accepts multiple image files or base64 encoded images
 */
router.post(
  '/analyze-video',
  authenticate,
  upload.array('frames', 100), // Max 100 frames
  [
    body('frames').optional().isArray(),
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

      // Get frames from uploaded files or base64 data
      let frames: Buffer[] = [];

      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        // Use uploaded files
        frames = (req.files as Express.Multer.File[]).map(file => file.buffer);
      } else if (req.body.frames && Array.isArray(req.body.frames)) {
        // Parse base64 encoded images
        frames = req.body.frames.map((frame: string) => {
          // Remove data URL prefix if present
          const base64Data = frame.replace(/^data:image\/\w+;base64,/, '');
          return Buffer.from(base64Data, 'base64');
        });
      } else {
        return res.status(400).json({ error: 'No frames provided' });
      }

      if (frames.length === 0) {
        return res.status(400).json({ error: 'No valid frames found' });
      }

      // Analyze the frames
      const sensorData = parseSensorData(req.body.sensorData);
      const result = await AIAnalysisService.analyzeVideoFrames(frames, sensorData);

      // Optionally save to database
      const saveToDatabase = req.body.save === true || req.body.save === 'true';
      
      if (saveToDatabase && result.faceDetected && result.vitals) {
        const timestamp = result.vitals.timestamp || new Date();
        const metrics: any[] = [];

        if (result.vitals.heartRate !== undefined) {
          metrics.push({
            metric_type: 'heart_rate',
            value: result.vitals.heartRate,
            unit: 'bpm',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.stressLevel !== undefined) {
          metrics.push({
            metric_type: 'stress_level',
            value: result.vitals.stressLevel,
            unit: 'score',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.oxygenSaturation !== undefined) {
          metrics.push({
            metric_type: 'oxygen_saturation',
            value: result.vitals.oxygenSaturation,
            unit: '%',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.respiratoryRate !== undefined) {
          metrics.push({
            metric_type: 'respiratory_rate',
            value: result.vitals.respiratoryRate,
            unit: 'breaths/min',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
        }

        if (result.vitals.temperature !== undefined) {
          metrics.push({
            metric_type: 'temperature',
            value: result.vitals.temperature,
            unit: '°C',
            start_time: timestamp,
            source: 'ai_face_analysis',
            confidence: result.vitals.confidence,
          });
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
      console.error('AI video analysis error:', error);
      res.status(500).json({
        error: 'Analysis failed',
        message: error.message,
      });
    }
  }
);

export default router;

