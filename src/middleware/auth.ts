import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import JWTService, { JWTPayload, AdminJWTPayload } from '../utils/jwtService.ts';
import TokenService from '../services/TokenService.ts';

const prisma = new PrismaClient();
const tokenService = new TokenService(prisma);

export interface RequestWithAuth extends Request {
    authUser?: {
        user: string;
        tenantId?: string;
        userId?: string;
        email?: string;
        role?: string;
    };
    authAdmin?: {
        adminId: string;
        email: string;
        role: string;
    };
}

export const authMiddleware = async (req: RequestWithAuth, res: Response, next: NextFunction) => {
    try {
        const token = JWTService.extractTokenFromHeader(req);
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'No token provided' 
            });
        }

        // Verify JWT token
        const decoded = JWTService.verifyAccessToken(token);
        
        if (JWTService.isUserPayload(decoded)) {
            // Handle regular user authentication
            const userPayload = decoded as JWTPayload;
            
            // Set user in request context
            req.authUser = {
                user: userPayload.email,
                userId: userPayload.userId,
                email: userPayload.email,
                role: userPayload.role,
                tenantId: userPayload.tenantId
            };
            
            return next();
        } else if (JWTService.isAdminPayload(decoded)) {
            // Handle admin authentication
            const adminPayload = decoded as AdminJWTPayload;
            
            // Validate admin token in database
            const admin = await tokenService.getAdminFromToken(token);
            if (!admin) {
                return res.status(401).json({ 
                    error: 'Authentication failed',
                    message: 'Invalid or expired token' 
                });
            }
            
            // Set admin in request context
            req.authAdmin = {
                adminId: admin.id,
                email: admin.email,
                role: admin.role
            };
            
            // Also set authUser for backward compatibility
            req.authUser = {
                user: admin.email,
                email: admin.email,
                role: admin.role
            };
            
            return next();
        }
        
        return res.status(401).json({ 
            error: 'Authentication failed',
            message: 'Invalid token payload' 
        });
        
    } catch (error) {
        return res.status(401).json({ 
            error: 'Authentication failed',
            message: 'Invalid or expired token' 
        });
    }
};

export const adminAuthMiddleware = async (req: RequestWithAuth, res: Response, next: NextFunction) => {
    try {
        const token = JWTService.extractTokenFromHeader(req);
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Admin authentication required',
                message: 'No token provided' 
            });
        }

        // Get admin from token (includes validation)
        const admin = await tokenService.getAdminFromToken(token);
        if (!admin) {
            return res.status(401).json({ 
                error: 'Admin authentication failed',
                message: 'Invalid or expired admin token' 
            });
        }

        // Check if admin is active
        if (!admin.is_active) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'Admin account is inactive' 
            });
        }

        // Set admin in request context
        req.authAdmin = {
            adminId: admin.id,
            email: admin.email,
            role: admin.role
        };

        // Also set authUser for backward compatibility
        req.authUser = {
            user: admin.email,
            email: admin.email,
            role: admin.role
        };

        next();
    } catch (error) {
        return res.status(401).json({ 
            error: 'Admin authentication failed',
            message: 'Invalid or expired token' 
        });
    }
};

export const superAdminAuthMiddleware = async (req: RequestWithAuth, res: Response, next: NextFunction) => {
    // First check admin authentication
    await adminAuthMiddleware(req, res, () => {
        // Check if admin has super admin role
        if (req.authAdmin?.role !== 'super_admin') {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'Super admin access required' 
            });
        }
        next();
    });
};

export const tenantAuthMiddleware = async (req: RequestWithAuth, res: Response, next: NextFunction) => {
    // Verify that the user has access to the tenant
    const tenantId = req.params.tenantId;
    
    if (!req.authUser?.user) {
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'User authentication required' 
        });
    }

    if (!tenantId) {
        return res.status(400).json({ 
            error: 'Bad request',
            message: 'Tenant ID required' 
        });
    }

    // TODO: Implement tenant access validation
    // In a real application, you would verify tenant access here
    // For now, just add tenantId to auth context
    req.authUser.tenantId = tenantId;
    next();
};

// Optional middleware for endpoints that work with or without authentication
export const optionalAuthMiddleware = async (req: RequestWithAuth, res: Response, next: NextFunction) => {
    const token = JWTService.extractTokenFromHeader(req);
    
    if (!token) {
        return next(); // No authentication, continue without user context
    }

    try {
        const decoded = JWTService.verifyAccessToken(token);
        
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
            const admin = await tokenService.getAdminFromToken(token);
            if (admin) {
                req.authAdmin = {
                    adminId: admin.id,
                    email: admin.email,
                    role: admin.role
                };
                req.authUser = {
                    user: admin.email,
                    email: admin.email,
                    role: admin.role
                };
            }
        }
    } catch (error) {
        // Invalid token, but continue without authentication
    }
    
    next();
};

// Legacy middleware for backward compatibility
export const authenticateUser = (req: RequestWithAuth, res: Response, next: NextFunction) => {
    return authMiddleware(req, res, next);
};

export const validateTenantAccess = (req: RequestWithAuth, res: Response, next: NextFunction) => {
    return tenantAuthMiddleware(req, res, next);
};
