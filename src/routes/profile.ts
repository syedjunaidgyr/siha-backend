import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { ProfileService } from '../services/profileService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await ProfileService.getProfile(req.user.id);
    res.json(profile);
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update user profile
router.put(
  '/profile',
  authenticate,
  [
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('height').optional().isFloat({ min: 50, max: 300 }),
    body('weight').optional().isFloat({ min: 20, max: 300 }),
    body('date_of_birth').optional().isISO8601(),
    body('goal').optional().isIn([
      'weight_loss',
      'weight_gain',
      'muscle_gain',
      'maintain',
      'general_fitness',
      'improve_endurance',
    ]),
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

      const { gender, height, weight, date_of_birth, goal } = req.body;
      const profile = await ProfileService.updateProfile(req.user.id, {
        gender,
        height,
        weight,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined,
        goal,
      });

      res.json({ message: 'Profile updated successfully', profile });
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Check if profile is complete
router.get('/profile/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isComplete = await ProfileService.isProfileComplete(req.user.id);
    res.json({ profile_complete: isComplete });
  } catch (error: any) {
    console.error('Check profile complete error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;

