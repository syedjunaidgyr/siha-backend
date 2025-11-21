import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { LifestylePredictionService } from '../services/lifestylePredictionService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate and save prediction for today
router.post('/lifestyle/predict', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const prediction = await LifestylePredictionService.generateAndSaveToday(req.user.id);
    res.json({ message: 'Prediction generated successfully', prediction });
  } catch (error: any) {
    console.error('Generate prediction error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get prediction for a specific date
router.get(
  '/lifestyle/predict',
  authenticate,
  [
    query('date').optional().isISO8601(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { date, start_date, end_date } = req.query;

      if (date) {
        // Get prediction for specific date
        const prediction = await LifestylePredictionService.getPrediction(
          req.user.id,
          new Date(date as string)
        );

        if (!prediction) {
          // Generate if doesn't exist
          const predictionData = await LifestylePredictionService.generatePrediction(
            req.user.id,
            new Date(date as string)
          );
          const saved = await LifestylePredictionService.savePrediction(
            req.user.id,
            new Date(date as string),
            predictionData
          );
          return res.json(saved);
        }

        return res.json(prediction);
      } else if (start_date && end_date) {
        // Get predictions for date range
        const predictions = await LifestylePredictionService.getPredictions(
          req.user.id,
          new Date(start_date as string),
          new Date(end_date as string)
        );
        return res.json({ predictions });
      } else {
        // Get today's prediction - always regenerate to ensure score is dynamic
        // This ensures the lifestyle score updates based on latest metrics
        const saved = await LifestylePredictionService.generateAndSaveToday(req.user.id);
        return res.json(saved);
      }
    } catch (error: any) {
      console.error('Get prediction error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

