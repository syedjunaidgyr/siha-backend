import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('mobile').isMobilePhone('en-IN'),
    body('password').isLength({ min: 8 }),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  ],
  async (req: Request, res: Response) => {
    try {
      console.log('Register endpoint hit:', req.body);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, mobile, password, name } = req.body;
      console.log('Attempting to register user:', email);
      const user = await AuthService.register(email, mobile, password, name);
      console.log('User registered successfully:', user.id);
      res.status(201).json({ message: 'User registered successfully', user });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      console.log('Login endpoint hit:', { email: req.body.email });
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      console.log('Attempting to login user:', email);
      const result = await AuthService.login(email, password);
      console.log('User logged in successfully:', result.user.id);
      res.json(result);
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  }
);

router.post(
  '/link-abha',
  authenticate,
  [
    body('abha_id').notEmpty(),
    body('abha_number').notEmpty(),
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

      const { abha_id, abha_number } = req.body;
      const user = await AuthService.linkABHA(req.user.id, abha_id, abha_number);
      res.json({ message: 'ABHA linked successfully', user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

