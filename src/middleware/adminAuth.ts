import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name?: string;
    role: 'admin' | 'super_admin';
  };
}

/**
 * JWT middleware for admin authentication
 * Verifies admin JWT tokens and adds admin data to request
 */
export const adminJWTMiddleware = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {  try {
    const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    
    // Get token from Authorization header only
    let token: string | undefined;
    
    // Only accept Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication required',
        code: 'NO_TOKEN'
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Validate token type
    if (decoded.type !== 'admin_access_token') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }
    
    // Check token expiry (additional check)
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Add admin data to request
    req.admin = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role || 'admin'
    };
    
    next();
    
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Admin JWT middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication error'
    });
  }
};

/**
 * Rate limiting for admin login attempts
 */
export const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator to include email in rate limiting
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body?.email || 'unknown';
    return `${ip}:${email}`;
  }
});

/**
 * Slow down repeated admin login attempts
 */
export const adminLoginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Allow 2 requests per windowMs without delay
  delayMs: () => 1000, // Add 1 second delay per request after delayAfter (new v2 syntax)
  maxDelayMs: 10000, // Maximum delay of 10 seconds
  validate: { delayMs: false }, // Disable the warning message
  // Custom key generator to include email in rate limiting
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body?.email || 'unknown';
    return `${ip}:${email}`;
  }
});

/**
 * General rate limiting for admin API endpoints
 */
export const adminAPIRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 admin API requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many admin API requests from this IP, please try again later',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Super admin role check middleware
 */
export const requireSuperAdmin = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  if (!req.admin) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin authentication required'
    });
  }
  
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Super admin access required',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  
  next();
};
