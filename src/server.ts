import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import sequelize from './config/database';

// Routes
import authRoutes from './routes/auth';
import metricsRoutes from './routes/metrics';
import devicesRoutes from './routes/devices';
import appointmentsRoutes from './routes/appointments';
import providersRoutes from './routes/providers';
import consentRoutes from './routes/consent';
import aiAnalysisRoutes from './routes/aiAnalysis';
import preventiveHealthRoutes from './routes/preventiveHealth';
import profileRoutes from './routes/profile';
import lifestyleRoutes from './routes/lifestyle';
import { auditLog } from './middleware/audit';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Security middleware - configure Helmet for development
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false, // Allow cross-origin for development
}));

// CORS configuration - allow all origins in development
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'multipart/form-data'],
}));

// Request logging middleware (before body parsing for debugging)
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Audit logging middleware
app.use(auditLog);

// Health check
app.get('/health', (req: Request, res: Response) => {
  console.log('Health check requested from:', req.ip);
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint for connectivity
app.get('/test', (req: Request, res: Response) => {
  console.log('Test endpoint hit from:', req.ip, req.headers);
  res.json({ message: 'Backend is reachable!', ip: req.ip, headers: req.headers });
});

// API routes
app.use('/v1/auth', authRoutes);
app.use('/v1', metricsRoutes);
app.use('/v1', devicesRoutes);
app.use('/v1', appointmentsRoutes);
app.use('/v1', providersRoutes);
app.use('/v1', consentRoutes);
app.use('/v1', profileRoutes);
app.use('/v1', lifestyleRoutes);
app.use('/v1/ai/preventive-health', preventiveHealthRoutes);
app.use('/v1/ai', aiAnalysisRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection and server startup
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync database (in production, use migrations)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: false });
      console.log('Database models synchronized.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      // Get network IP address
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      let networkIP = 'localhost';
      
      for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces || []) {
          // Skip internal (loopback) and non-IPv4 addresses
          if (iface.family === 'IPv4' && !iface.internal) {
            networkIP = iface.address;
            break;
          }
        }
        if (networkIP !== 'localhost') break;
      }
      
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Server accessible at http://localhost:${PORT}`);
      console.log(`For Android emulator: http://10.0.2.2:${PORT}`);
      console.log(`For physical device: http://${networkIP}:${PORT}`);
      console.log(`Network IP detected: ${networkIP}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;

