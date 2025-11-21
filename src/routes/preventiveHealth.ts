import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PreventiveHealthService } from '../services/preventiveHealthService';
import User from '../models/User';

const router = Router();

router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const lookbackParam = req.query.lookbackDays;
      const lookbackDays = lookbackParam ? parseInt(lookbackParam as string, 10) : undefined;

      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userRecord = await User.findByPk(req.user.id);
      const userProfile = PreventiveHealthService.buildUserProfilePayload(userRecord || undefined);

      try {
        const insights = await PreventiveHealthService.getInsights(req.user.id, {
          lookbackDays,
          userProfile,
        });

        res.json({ success: true, result: insights });
      } catch (error: any) {
        // Handle "no metrics" case gracefully
        if (error.message === 'No metrics available for preventive insights') {
          console.log(`[PreventiveHealthRoute] No metrics found for user ${req.user.id}, returning empty insights`);
          
          // Return empty/default insights structure instead of error
          res.json({
            success: true,
            result: {
              lifestyleCard: null,
              lifestylePlan: null,
              summary: {
                message: 'Start tracking your health metrics to get personalized insights',
                nextBestAction: 'Connect a health device or manually log your first metrics to enable AI insights',
              },
              metrics: {
                available: false,
                message: 'No metrics available. Please track some health data to get insights.',
              },
            },
          });
          return;
        }

        // Re-throw other errors to be caught by outer catch
        throw error;
      }
    } catch (error: any) {
      console.error('[PreventiveHealthRoute] GET error:', error);
      res.status(500).json({
        error: 'Unable to fetch preventive insights',
        message: error.message,
      });
    }
  }
);

router.post(
  '/preview',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const metrics = req.body.metrics;
      if (!Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ error: 'metrics array is required' });
      }

      const lookbackDays = req.body.lookbackDays ? parseInt(req.body.lookbackDays, 10) : undefined;

      const userRecord = await User.findByPk(req.user.id);
      const userProfile = PreventiveHealthService.buildUserProfilePayload(userRecord || undefined);

      const insights = await PreventiveHealthService.getInsights(req.user.id, {
        lookbackDays,
        metricsOverride: metrics,
        userProfile,
      });

      res.json({ success: true, result: insights });
    } catch (error: any) {
      console.error('[PreventiveHealthRoute] preview error:', error);
      res.status(500).json({
        error: 'Unable to generate preview insights',
        message: error.message,
      });
    }
  }
);

export default router;

