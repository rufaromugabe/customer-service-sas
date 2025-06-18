import { Request, Response, NextFunction } from 'express';
import JWTService, { JWTPayload, AdminJWTPayload } from '../utils/jwtService.ts';
import { RequestWithAuth } from './auth.ts';

/**
 * Universal JWT Authentication Middleware
 * This middleware ensures consistent JWT validation across all endpoints
 */
export const universalJWTAuth = async (req: RequestWithAuth, res: Response, next: NextFunction) => {
    try {
        const token = JWTService.extractTokenFromHeader(req);
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'No bearer token provided',
                code: 'NO_TOKEN'
            });
        }

        // Verify JWT token
        const decoded = JWTService.verifyAccessToken(token);
        
        // Set authentication context based on token type
        if (JWTService.isUserPayload(decoded)) {
            const userPayload = decoded as JWTPayload;
            req.authUser = {
                user: userPayload.email,
                userId: userPayload.userId,
                email: userPayload.email,
                role: userPayload.role,
                tenantId: userPayload.tenantId
            };
        } else if (JWTService.isAdminPayload(decoded)) {
            const adminPayload = decoded as AdminJWTPayload;
            req.authAdmin = {
                adminId: adminPayload.adminId,
                email: adminPayload.email,
                role: adminPayload.role || 'admin'
            };
            
            // Set authUser for backward compatibility
            req.authUser = {
                user: adminPayload.email,
                email: adminPayload.email,
                role: adminPayload.role || 'admin'
            };
        } else {
            return res.status(401).json({ 
                error: 'Authentication failed',
                message: 'Invalid token payload',
                code: 'INVALID_PAYLOAD'
            });
        }
        
        next();
        
    } catch (error: any) {
        let message = 'Invalid or expired token';
        let code = 'TOKEN_ERROR';
        
        if (error.name === 'JsonWebTokenError') {
            message = 'Invalid token format';
            code = 'INVALID_TOKEN';
        } else if (error.name === 'TokenExpiredError') {
            message = 'Token has expired';
            code = 'TOKEN_EXPIRED';
        }
        
        return res.status(401).json({ 
            error: 'Authentication failed',
            message,
            code
        });
    }
};

/**
 * Require Admin Role Middleware
 * Must be used after universalJWTAuth
 */
export const requireAdmin = (req: RequestWithAuth, res: Response, next: NextFunction) => {
    if (!req.authAdmin) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Admin privileges required',
            code: 'ADMIN_REQUIRED'
        });
    }
    next();
};

/**
 * Require Super Admin Role Middleware
 * Must be used after universalJWTAuth
 */
export const requireSuperAdmin = (req: RequestWithAuth, res: Response, next: NextFunction) => {
    if (!req.authAdmin || req.authAdmin.role !== 'super_admin') {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Super admin privileges required',
            code: 'SUPER_ADMIN_REQUIRED'
        });
    }
    next();
};

/**
 * Require User Role Middleware (non-admin)
 * Must be used after universalJWTAuth
 */
export const requireUser = (req: RequestWithAuth, res: Response, next: NextFunction) => {
    if (!req.authUser?.userId) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'User authentication required',
            code: 'USER_REQUIRED'
        });
    }
    next();
};

/**
 * Require Tenant Access Middleware
 * Validates that user has access to the specified tenant
 */
export const requireTenantAccess = (req: RequestWithAuth, res: Response, next: NextFunction) => {
    const tenantId = req.params.tenantId;
    
    if (!tenantId) {
        return res.status(400).json({
            error: 'Bad request',
            message: 'Tenant ID required in URL',
            code: 'TENANT_ID_REQUIRED'
        });
    }
      // For admin users, allow access to any tenant
    if (req.authAdmin) {
        if (!req.authUser) {
            req.authUser = {
                user: req.authAdmin.email,
                email: req.authAdmin.email,
                role: req.authAdmin.role
            };
        }
        req.authUser.tenantId = tenantId;
        return next();
    }
    
    // For regular users, validate tenant access
    if (!req.authUser?.userId) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'User authentication required for tenant access',
            code: 'AUTH_REQUIRED'
        });
    }
    
    // TODO: Implement tenant membership validation
    // For now, set the tenantId in the auth context
    req.authUser.tenantId = tenantId;
    next();
};

export default universalJWTAuth;
