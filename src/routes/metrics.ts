import { Router, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import { MetricService } from '../services/metricService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/sync/healthkit',
  authenticate,
  [
    body('metrics').isArray().notEmpty(),
    body('metrics.*.metric_type').notEmpty(),
    body('metrics.*.value').isNumeric(),
    body('metrics.*.unit').notEmpty(),
    body('metrics.*.start_time').isISO8601(),
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

      const { metrics, device_id } = req.body;
      const metricInputs = metrics.map((m: any) => ({
        ...m,
        start_time: new Date(m.start_time),
        end_time: m.end_time ? new Date(m.end_time) : undefined,
        source: 'healthkit',
        device_id,
      }));

      const records = await MetricService.createBatchMetrics(req.user.id, metricInputs);
      res.status(201).json({ message: 'Metrics synced successfully', count: records.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.post(
  '/sync/health-connect',
  authenticate,
  [
    body('metrics').isArray().notEmpty(),
    body('metrics.*.metric_type').notEmpty(),
    body('metrics.*.value').isNumeric(),
    body('metrics.*.unit').notEmpty(),
    body('metrics.*.start_time').isISO8601(),
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

      const { metrics, device_id } = req.body;
      const metricInputs = metrics.map((m: any) => ({
        ...m,
        start_time: new Date(m.start_time),
        end_time: m.end_time ? new Date(m.end_time) : undefined,
        source: 'health_connect',
        device_id,
      }));

      const records = await MetricService.createBatchMetrics(req.user.id, metricInputs);
      res.status(201).json({ message: 'Metrics synced successfully', count: records.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.post(
  '/vitals/ai-analysis',
  authenticate,
  [
    body('vitals').isObject(),
    body('vitals.heartRate').optional().isNumeric(),
    body('vitals.stressLevel').optional().isNumeric(),
    body('vitals.oxygenSaturation').optional().isNumeric(),
    body('vitals.respiratoryRate').optional().isNumeric(),
    body('vitals.confidence').optional().isNumeric(),
    body('vitals.timestamp').isISO8601(),
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

      const { vitals } = req.body;
      const timestamp = new Date(vitals.timestamp);
      const metrics: any[] = [];

      if (vitals.heartRate !== undefined) {
        metrics.push({
          metric_type: 'heart_rate',
          value: vitals.heartRate,
          unit: 'bpm',
          start_time: timestamp,
          source: 'ai_face_analysis',
          confidence: vitals.confidence,
        });
      }

      if (vitals.stressLevel !== undefined) {
        metrics.push({
          metric_type: 'stress_level',
          value: vitals.stressLevel,
          unit: 'score',
          start_time: timestamp,
          source: 'ai_face_analysis',
          confidence: vitals.confidence,
        });
      }

      if (vitals.oxygenSaturation !== undefined) {
        metrics.push({
          metric_type: 'oxygen_saturation',
          value: vitals.oxygenSaturation,
          unit: '%',
          start_time: timestamp,
          source: 'ai_face_analysis',
          confidence: vitals.confidence,
        });
      }

      if (vitals.respiratoryRate !== undefined) {
        metrics.push({
          metric_type: 'respiratory_rate',
          value: vitals.respiratoryRate,
          unit: 'breaths/min',
          start_time: timestamp,
          source: 'ai_face_analysis',
          confidence: vitals.confidence,
        });
      }

      if (metrics.length > 0) {
        const records = await MetricService.createBatchMetrics(req.user.id, metrics);
        res.status(201).json({
          message: 'Vital signs recorded successfully',
          count: records.length,
          vitals: vitals,
        });
      } else {
        res.status(400).json({ error: 'No valid vital signs provided' });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.get(
  '/users/:userId/metrics',
  authenticate,
  [
    query('type').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user || req.user.id !== req.params.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { type, from, to, limit, offset } = req.query;
      const result = await MetricService.getMetrics(req.user.id, {
        metric_type: type as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

