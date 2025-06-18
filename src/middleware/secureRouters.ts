import { Router } from 'express';
import { universalJWTAuth, requireAdmin, requireTenantAccess } from '../middleware/index.ts';

/**
 * Authentication Enforcement Router
 * This router applies universal JWT authentication to all routes that need protection
 */
export const createSecureRouter = () => {
    const secureRouter = Router();
    
    // Apply universal JWT auth to all routes by default
    secureRouter.use(universalJWTAuth);
    
    return secureRouter;
};

/**
 * Admin-only router with enhanced security
 */
export const createAdminRouter = () => {
    const adminRouter = Router();
    
    // Apply universal JWT auth + admin requirement
    adminRouter.use(universalJWTAuth);
    adminRouter.use(requireAdmin);
    
    return adminRouter;
};

/**
 * Tenant-scoped router with user authentication
 */
export const createTenantRouter = () => {
    const tenantRouter = Router();
    
    // Apply universal JWT auth + tenant access validation
    tenantRouter.use(universalJWTAuth);
    tenantRouter.use(requireTenantAccess);
    
    return tenantRouter;
};

/**
 * Public router (no authentication required)
 * Only for auth endpoints like login, register, etc.
 */
export const createPublicRouter = () => {
    const publicRouter = Router();
    // No authentication middleware applied
    return publicRouter;
};

export default {
    createSecureRouter,
    createAdminRouter,
    createTenantRouter,
    createPublicRouter
};
