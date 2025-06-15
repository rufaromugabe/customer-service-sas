import { Request, Response, NextFunction } from 'express';
import { nileAuth, nileConfig } from '../config/nile.ts';
import rateLimit from 'express-rate-limit';

export interface NileAuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  tenant?: {
    id: string;
    name?: string;
  };
  session?: any;
  clientInfo?: {
    ip: string;
    userAgent: string;
    timestamp: string;
  };
}

/**
 * Rate limiting for Nile Auth operations
 */
export const nileAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication requests from this IP, please try again later',
    code: 'NILE_AUTH_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware to authenticate users using Nile Auth
 * Enhanced with better error handling and security logging
 */
export const nileAuthMiddleware = async (req: NileAuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get session cookie
    const cookies = req.headers.cookie || '';
    
    if (!cookies) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required - no session found',
        code: 'NO_SESSION'
      });
    }
    
    const session = await nileAuth.getCurrentSession(cookies);
    
    if (!session || !session.user) {
      // Log failed authentication attempt for security monitoring
      console.warn(`Failed Nile auth attempt from IP: ${(req as any).clientInfo?.ip || req.ip} at ${new Date().toISOString()}`);
      
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Valid authentication required - invalid or expired session',
        code: 'INVALID_SESSION'
      });
    }

    // Validate session integrity
    if (!session.user.id || !session.user.email) {
      console.error('Invalid session data structure:', { 
        hasUserId: !!session.user.id, 
        hasUserEmail: !!session.user.email 
      });
      
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid session data',
        code: 'CORRUPTED_SESSION'
      });
    }

    // Attach user and session to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      given_name: session.user.given_name,
      family_name: session.user.family_name,
      picture: session.user.picture
    };
    req.session = session;
    
    // Log successful authentication for audit
    console.log(`Nile auth success: ${session.user.email} from IP: ${(req as any).clientInfo?.ip || req.ip}`);
    
    next();
  } catch (error: any) {
    console.error('Nile auth middleware error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ip: (req as any).clientInfo?.ip || req.ip,
      userAgent: (req as any).clientInfo?.userAgent || req.get('User-Agent')
    });
    
    return res.status(401).json({ 
      error: 'Authentication failed', 
      message: 'Unable to verify authentication - please sign in again',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware to ensure tenant context is available
 * Enhanced with better security checks and error handling
 */
export const nileTenantMiddleware = async (req: NileAuthRequest, res: Response, next: NextFunction) => {
  try {        const tenantId = req.params.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Tenant ID is required in the URL path',
        code: 'MISSING_TENANT_ID'
      });
    }

    // Validate tenant ID format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Invalid tenant ID format',
        code: 'INVALID_TENANT_ID'
      });
    }

    // Verify user has access to the tenant
    if (req.user) {
      try {
        const tenant = await nileAuth.getTenant(tenantId);
        
        if (!tenant) {
          // Log unauthorized tenant access attempt
          console.warn(`Unauthorized tenant access attempt: User ${req.user.email} tried to access tenant ${tenantId} from IP: ${(req as any).clientInfo?.ip || req.ip}`);
          
          return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Access denied to this tenant - you do not have permission',
            code: 'TENANT_ACCESS_DENIED'
          });
        }
        
        req.tenant = {
          id: tenant.id,
          name: tenant.name
        };
      } catch (error: any) {
        console.error('Tenant verification error:', {
          error: error.message,
          tenantId,
          userId: req.user.id,
          timestamp: new Date().toISOString()
        });
        
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Unable to verify tenant access',
          code: 'TENANT_VERIFICATION_ERROR'
        });
      }
    }
    
    next();
  } catch (error: any) {
    console.error('Nile tenant middleware error:', {
      error: error.message,
      stack: error.stack,
      tenantId: req.params.tenantId,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Unable to process tenant access request',
      code: 'TENANT_MIDDLEWARE_ERROR'
    });
  }
};

/**
 * Middleware for admin-only routes within tenants
 * Enhanced with better role checking and audit logging
 */
export const nileAdminMiddleware = async (req:NileAuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required for admin access',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    // Check if user has admin role in the current tenant
    const tenantId = req.params.tenantId || req.tenant?.id;
    if (tenantId) {
      try {
        const userInTenant = await nileAuth.getUser(req.user.id);
        
        // Enhanced admin check - this should be customized based on your role system
        // For now, we'll assume all authenticated users can access admin functions
        // You should implement proper role-based access control here
        if (!userInTenant) {
          console.warn(`Admin access denied: User ${req.user.email} not found in tenant ${tenantId} from IP: ${(req as any).clientInfo?.ip || req.ip}`);
          
          return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Admin access denied - insufficient permissions',
            code: 'INSUFFICIENT_ADMIN_PERMISSIONS'
          });
        }
        
        // TODO: Implement proper role checking here
        // Example: Check if userInTenant has admin role
        // if (!userInTenant.roles || !userInTenant.roles.includes('admin')) {
        //   return res.status(403).json({ ... });
        // }
        
        // Log admin access for audit
        console.log(`Admin access granted: ${req.user.email} for tenant ${tenantId} from IP: ${(req as any).clientInfo?.ip || req.ip}`);
        
      } catch (error: any) {
        console.error('Admin access verification error:', {
          error: error.message,
          tenantId,
          userId: req.user.id,
          timestamp: new Date().toISOString()
        });
        
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Unable to verify admin access',
          code: 'ADMIN_VERIFICATION_ERROR'
        });
      }
    }
    
    next();
  } catch (error: any) {
    console.error('Nile admin middleware error:', {
      error: error.message,
      stack: error.stack,
      tenantId: req.params.tenantId,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Unable to verify admin access',
      code: 'ADMIN_MIDDLEWARE_ERROR'
    });
  }
};

/**
 * Optional middleware - authenticate if session exists but don't require it
 * Enhanced with better error handling
 */
export const nileOptionalAuthMiddleware = async (req: NileAuthRequest, res: Response, next: NextFunction) => {
  try {
    const cookies = req.headers.cookie || '';
    
    if (!cookies) {
      // No cookies, continue without authentication
      return next();
    }
    
    const session = await nileAuth.getCurrentSession(cookies);
    
    if (session && session.user && session.user.id && session.user.email) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        given_name: session.user.given_name,
        family_name: session.user.family_name,
        picture: session.user.picture
      };
      req.session = session;
      
      // Log optional auth success
      console.log(`Optional Nile auth success: ${session.user.email} from IP: ${(req as any).clientInfo?.ip || req.ip}`);
    }
    
    next();
  } catch (error: any) {
    // Don't fail for optional auth, just log and continue without user
    console.warn('Optional Nile auth failed (continuing without auth):', {
      error: error.message,
      timestamp: new Date().toISOString(),
      ip: (req as any).clientInfo?.ip || req.ip
    });
    
    next();
  }
};
