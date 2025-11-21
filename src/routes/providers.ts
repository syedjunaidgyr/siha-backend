import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import Provider from '../models/Provider';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all active providers (public endpoint)
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const { specialty, search } = req.query;

    const where: any = {
      is_active: true,
      is_verified: true,
    };

    if (specialty) {
      where.specialties = { [Op.contains]: [specialty] };
    }

    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const providers = await Provider.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.json(providers);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get provider by ID
router.get('/providers/:id', async (req: Request, res: Response) => {
  try {
    const provider = await Provider.findByPk(req.params.id);

    if (!provider || !provider.is_active) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json(provider);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Onboard provider (admin endpoint - should be protected with admin role)
router.post(
  '/providers/onboard',
  authenticate,
  [
    body('name').notEmpty(),
    body('specialties').isArray().notEmpty(),
    body('hpr_id').optional().isString(),
    body('hospital_id').optional().isString(),
    body('hospital_name').optional().isString(),
    body('email').optional().isEmail(),
    body('mobile').optional().isMobilePhone('en-IN'),
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

      // TODO: Add admin role check
      const { name, specialties, hpr_id, hospital_id, hospital_name, email, mobile } = req.body;

      const provider = await Provider.create({
        name,
        specialties,
        hpr_id,
        hospital_id,
        hospital_name,
        email,
        mobile,
        is_verified: false, // Requires manual verification
        is_active: true,
      });

      res.status(201).json({ message: 'Provider onboarded successfully', provider });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

