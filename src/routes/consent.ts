import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Consent from '../models/Consent';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/consent/abha/share',
  authenticate,
  [
    body('consent_type').isIn(['data_collection', 'data_sharing', 'abha_share', 'provider_access']),
    body('scope').isArray().notEmpty(),
    body('granted_to').optional().isString(),
    body('expires_at').optional().isISO8601(),
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

      const { consent_type, scope, granted_to, expires_at, abha_consent_id } = req.body;

      const consent = await Consent.create({
        user_id: req.user.id,
        consent_type: consent_type as any,
        scope,
        granted_to,
        expires_at: expires_at ? new Date(expires_at) : undefined,
        abha_consent_id,
        is_active: true,
      });

      res.status(201).json({ message: 'Consent recorded successfully', consent });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.get('/consents', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const consents = await Consent.findAll({
      where: {
        user_id: req.user.id,
        is_active: true,
      },
      order: [['created_at', 'DESC']],
    });

    res.json(consents);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/consents/:id/revoke', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const consent = await Consent.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id,
      },
    });

    if (!consent) {
      return res.status(404).json({ error: 'Consent not found' });
    }

    consent.is_active = false;
    await consent.save();

    res.json({ message: 'Consent revoked successfully', consent });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

