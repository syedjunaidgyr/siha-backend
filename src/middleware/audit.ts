import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from './auth';

export const auditLog = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const originalSend = res.send;
  
  res.send = function (body) {
    // Log after response is sent
    setImmediate(async () => {
      try {
        await AuditLog.create({
          user_id: req.user?.id,
          action: `${req.method} ${req.path}`,
          resource_type: req.path.split('/')[1] || 'unknown',
          resource_id: req.params.id,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            query: req.query,
          },
          ip_address: req.ip || req.socket.remoteAddress,
          user_agent: req.get('user-agent'),
        });
      } catch (error) {
        console.error('Audit log error:', error);
      }
    });
    
    return originalSend.call(this, body);
  };
  
  next();
};

