import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { DeviceService } from '../services/deviceService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/devices/link',
  authenticate,
  [
    body('vendor').isIn(['healthkit', 'health_connect', 'fitbit', 'garmin', 'samsung', 'other']),
    body('device_id').notEmpty(),
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

      const { vendor, device_id, device_name, oauth_tokens } = req.body;
      const device = await DeviceService.linkDevice(
        req.user.id,
        vendor,
        device_id,
        device_name,
        oauth_tokens
      );

      res.status(201).json({ message: 'Device linked successfully', device });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.get('/devices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const devices = await DeviceService.getUserDevices(req.user.id);
    res.json(devices);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/devices/:deviceId/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const device = await DeviceService.updateLastSync(req.params.deviceId, req.user.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ message: 'Device synced successfully', device });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/devices/:deviceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const device = await DeviceService.deactivateDevice(req.params.deviceId, req.user.id);
    res.json({ message: 'Device deactivated successfully', device });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.post(
  '/devices/oauth/fitbit/callback',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Handle Fitbit OAuth callback
      // This would typically exchange the authorization code for tokens
      const { code, device_id, device_name } = req.body;

      // TODO: Implement actual OAuth token exchange with Fitbit API
      // For now, this is a placeholder
      res.json({ message: 'Fitbit OAuth callback received', code });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

