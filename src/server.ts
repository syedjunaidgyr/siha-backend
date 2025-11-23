import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import sequelize from './config/database';
import { runMigrations } from './utils/runMigrations';
import { ensureMetricTypeEnumValues } from './utils/ensureEnumValues';

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
// Skip JSON parsing for multipart/form-data requests (handled by multer)
app.use((req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Skip JSON parsing for multipart requests - multer will handle it
    return next();
  }
  // Use JSON parser for other requests
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Skip URL encoded parsing for multipart requests
    return next();
  }
  // Use URL encoded parser for other requests
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

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
// Health check endpoint under /v1 for API clients
app.get('/v1/health', (req: Request, res: Response) => {
  console.log('API health check requested from:', req.ip);
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
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
// Legacy route alias: /api/ai/* -> /v1/ai/* (for backward compatibility)
app.use('/api/ai', aiAnalysisRoutes);

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
  console.error(`404 - Route not found: ${req.method} ${req.url}`);
  console.error('Request headers:', req.headers);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.url,
  });
});

// Database connection and server startup
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Run migrations to ensure database schema is up to date
    console.log('Running database migrations...');
    await runMigrations(sequelize);
    console.log('Database migrations completed.');

    // Ensure ENUM values are present (safety check for migrations that might have been skipped)
    console.log('Verifying ENUM values...');
    await ensureMetricTypeEnumValues(sequelize);
    console.log('ENUM values verified.');

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

