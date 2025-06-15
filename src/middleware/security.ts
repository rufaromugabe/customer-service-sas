import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow for API usage
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

/**
 * CORS configuration for production use
 */
export const corsMiddleware = cors({
  origin: (origin: string | undefined, callback: (error: Error | null, success?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // In production, this should be configured with specific allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite default
      'http://localhost:8080'
    ];
    
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count']
});

/**
 * General API rate limiting
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => {
    return req.path === '/api/health' || req.path === '/api/db-status';
  }
});

/**
 * Authentication endpoint rate limiting (more strict)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts from this IP, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Request sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Remove null bytes that could be used for injection attacks
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value.replace(/\0/g, '');
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  
  next();
};

/**
 * Request size limiting middleware
 */
export const limitRequestSize = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = req.get('Content-Length');
  const maxSize = 10 * 1024 * 1024; // 10MB limit
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body too large',
      maxSize: '10MB'
    });
  }
  
  next();
};

/**
 * IP tracking middleware for audit logs
 */
export const trackClientInfo = (req: Request, res: Response, next: NextFunction) => {
  // Get real IP address (considering proxies)
  const realIP = req.get('X-Forwarded-For') || 
                 req.get('X-Real-IP') || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress || 
                 'unknown';
  
  // Get user agent
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Add to request for audit logging
  (req as any).clientInfo = {
    ip: realIP.split(',')[0].trim(), // First IP in case of multiple proxies
    userAgent,
    timestamp: new Date().toISOString()
  };
  
  next();
};

/**
 * Security middleware for sensitive operations
 */
export const sensitiveOperationSecurity = [
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Very limited for sensitive operations
    message: {
      error: 'Too Many Requests',
      message: 'Too many sensitive operations from this IP, please try again later',
      code: 'SENSITIVE_OPERATION_RATE_LIMIT'
    }
  }),
  trackClientInfo
];
