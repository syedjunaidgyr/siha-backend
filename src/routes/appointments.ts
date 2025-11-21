import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import Appointment from '../models/Appointment';
import Provider from '../models/Provider';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/appointments',
  authenticate,
  [
    body('provider_id').isUUID(),
    body('appointment_time').isISO8601(),
    body('notes').optional().isString(),
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

      const { provider_id, appointment_time, notes } = req.body;

      const provider = await Provider.findByPk(provider_id);
      if (!provider || !provider.is_active) {
        return res.status(404).json({ error: 'Provider not found or inactive' });
      }

      const appointment = await Appointment.create({
        user_id: req.user.id,
        provider_id,
        appointment_time: new Date(appointment_time),
        status: 'scheduled',
        notes,
      });

      const appointmentWithProvider = await Appointment.findByPk(appointment.id, {
        include: [{ model: Provider, as: 'provider' }],
      });

      res.status(201).json({ message: 'Appointment created successfully', appointment: appointmentWithProvider });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.get('/appointments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const appointments = await Appointment.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Provider, as: 'provider' }],
      order: [['appointment_time', 'DESC']],
    });

    res.json(appointments);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/appointments/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const appointment = await Appointment.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id,
      },
      include: [{ model: Provider, as: 'provider' }],
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch(
  '/appointments/:id',
  authenticate,
  [
    body('status').optional().isIn(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']),
    body('notes').optional().isString(),
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

      const appointment = await Appointment.findOne({
        where: {
          id: req.params.id,
          user_id: req.user.id,
        },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (req.body.status) {
        appointment.status = req.body.status as any;
      }
      if (req.body.notes !== undefined) {
        appointment.notes = req.body.notes;
      }

      await appointment.save();

      const updatedAppointment = await Appointment.findByPk(appointment.id, {
        include: [{ model: Provider, as: 'provider' }],
      });

      res.json({ message: 'Appointment updated successfully', appointment: updatedAppointment });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

