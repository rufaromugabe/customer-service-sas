import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AdminController, TenantController, PlanController, AnalyticsController } from '../controllers/index.ts';
import { 
    universalJWTAuth,
    requireAdmin,
    requireSuperAdmin,
    errorHandler, 
    asyncHandler, 
    adminLoginRateLimit,
    adminLoginSlowDown,
    adminAPIRateLimit,
    securityHeaders,
    trackClientInfo,
    sensitiveOperationSecurity
} from '../middleware/index.ts';

const adminRouter = Router();
const prisma = new PrismaClient();

// Apply security headers and client tracking to all admin routes
adminRouter.use(securityHeaders);
adminRouter.use(trackClientInfo);
adminRouter.use(adminAPIRateLimit);

// Initialize controllers
const adminController = new AdminController(prisma);
const tenantController = new TenantController();
const planController = new PlanController(prisma);
const analyticsController = new AnalyticsController();

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Returns the health status of the API
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
// Health check endpoint - now protected
adminRouter.get('/health', universalJWTAuth, requireAdmin, (req: any, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'ai-customer-service-saas-backend',
        admin: req.authAdmin?.email
    });
});

/**
 * @swagger
 * /api/health/public:
 *   get:
 *     tags: [Health]
 *     summary: Public health check endpoint
 *     description: Returns the health status of the API (minimal info)
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// Public health check endpoint (minimal info)
adminRouter.get('/health/public', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString()
    });
});

/**
 * @swagger
 * /api/db-status:
 *   get:
 *     tags: [Health]
 *     summary: Database connectivity check (Admin only)
 *     description: Tests the database connection and returns status. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database is connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: connected/**
 * @swagger
 * /api/db-status:
 *   get:
 *     tags: [Health]
 *     summary: Database connectivity check (Admin only)
 *     description: Tests the database connection and returns status. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database is connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: connected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Database is disconnected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: disconnected
 *                 error:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Database connection test endpoint - now protected
adminRouter.get('/db-status', universalJWTAuth, requireAdmin, async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1 as test`;
        res.json({ 
            status: 'connected', 
            timestamp: new Date().toISOString() 
        });
    } catch (error: any) {
        res.status(503).json({ 
            status: 'disconnected', 
            error: error.message,
            timestamp: new Date().toISOString() 
        });
    }
});

// --- Authentication & Admin Management ---
/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     tags: [Admin Authentication]
 *     summary: Admin login
 *     description: Authenticate an admin user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Admin logged in successfully.
 *                 adminId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
adminRouter.post('/auth/admin/login', 
    adminLoginRateLimit, 
    adminLoginSlowDown, 
    asyncHandler(adminController.loginAdmin)
);
/**
 * @swagger
 * /api/auth/admin/logout:
 *   post:
 *     tags: [Admin Authentication]
 *     summary: Admin logout
 *     description: Log out the current authenticated admin user
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Admin logged out successfully
 */
adminRouter.post('/auth/admin/logout', universalJWTAuth, requireAdmin, asyncHandler(adminController.logoutAdmin));

/**
 * @swagger
 * /api/auth/admin/me:
 *   get:
 *     tags: [Admin Authentication]
 *     summary: Get current admin profile
 *     description: Retrieve the current authenticated admin's profile information
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       401:
 *         description: Unauthorized
 */
adminRouter.get('/auth/admin/me', universalJWTAuth, requireAdmin, asyncHandler(adminController.getCurrentAdmin));

/**
 * @swagger
 * /api/auth/admin/refresh:
 *   post:
 *     tags: [Admin Authentication]
 *     summary: Refresh admin access token
 *     description: Use refresh token to get a new access token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
adminRouter.post('/auth/admin/refresh', asyncHandler(adminController.refreshToken));

/**
 * @swagger
 * /api/auth/admin/revoke-all:
 *   post:
 *     tags: [Admin Authentication]
 *     summary: Revoke all admin tokens
 *     description: Revoke all active tokens for the current admin (logout from all devices)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All tokens revoked successfully
 *       401:
 *         description: Unauthorized
 */
adminRouter.post('/auth/admin/revoke-all', universalJWTAuth, requireAdmin, asyncHandler(adminController.revokeAllTokens));

// Admin CRUD operations
/**
 * @swagger
 * /api/admins:
 *   get:
 *     tags: [Admin Management]
 *     summary: Get all admins
 *     description: Retrieve a list of all admin users
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Admins retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Admin'
 */
adminRouter.get('/admins', universalJWTAuth, requireAdmin, asyncHandler(adminController.getAllAdmins));

/**
 * @swagger
 * /api/admins:
 *   post:
 *     tags: [Admin Management]
 *     summary: Create new admin
 *     description: Create a new admin user
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               name:
 *                 type: string
 *                 example: John Admin
 *               password:
 *                 type: string
 *                 example: securepassword123
 *     responses:
 *       201:
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 */
adminRouter.post('/admins', 
    universalJWTAuth, requireAdmin, 
    requireSuperAdmin, 
    ...sensitiveOperationSecurity, 
    asyncHandler(adminController.createAdmin)
);

/**
 * @swagger
 * /api/admins/{id}:
 *   get:
 *     tags: [Admin Management]
 *     summary: Get admin by ID
 *     description: Retrieve a specific admin by their ID
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Admin ID
 *     responses:
 *       200:
 *         description: Admin retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       404:
 *         description: Admin not found
 */
adminRouter.get('/admins/:id', universalJWTAuth, requireAdmin, asyncHandler(adminController.getAdminById));

/**
 * @swagger
 * /api/admins/{id}:
 *   put:
 *     tags: [Admin Management]
 *     summary: Update admin
 *     description: Update an existing admin user
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Admin ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 */
adminRouter.put('/admins/:id', 
    universalJWTAuth, requireAdmin, 
    ...sensitiveOperationSecurity, 
    asyncHandler(adminController.updateAdmin)
);

/**
 * @swagger
 * /api/admins/{id}:
 *   delete:
 *     tags: [Admin Management]
 *     summary: Delete admin
 *     description: Delete an admin user (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Admin ID
 *     responses:
 *       200:
 *         description: Admin deleted successfully
 *       404:
 *         description: Admin not found
 *       403:
 *         description: Super admin access required
 */
adminRouter.delete('/admins/:id', 
    universalJWTAuth, requireAdmin, 
    requireSuperAdmin, 
    ...sensitiveOperationSecurity, 
    asyncHandler(adminController.deleteAdmin)
);

// --- Organization Management ---
/**
 * @swagger
 * /api/organizations:
 *   get:
 *     tags: [Tenant Management]
 *     summary: List all tenants/organizations
 *     description: Retrieve a list of all tenant organizations
 *     responses:
 *       200:
 *         description: List of tenants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tenant'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
adminRouter.get('/organizations', universalJWTAuth, requireAdmin, asyncHandler(tenantController.getAllTenants));

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     tags: [Tenant Management]
 *     summary: Create a new tenant/organization
 *     description: Create a new tenant organization
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Corporation
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional custom ID
 *               current_plan_id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional plan ID
 *     responses:
 *       201:
 *         description: Tenant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tenant'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
adminRouter.post('/organizations', universalJWTAuth, requireAdmin, asyncHandler(tenantController.createTenant));
adminRouter.get('/organizations/:id', universalJWTAuth, requireAdmin, asyncHandler(tenantController.getTenantById));
adminRouter.put('/organizations/:id', universalJWTAuth, requireAdmin, asyncHandler(tenantController.updateTenant));
adminRouter.delete('/organizations/:id', universalJWTAuth, requireAdmin, requireSuperAdmin, ...sensitiveOperationSecurity, asyncHandler(tenantController.deleteTenant));
adminRouter.post('/organizations/:id/activate', universalJWTAuth, requireAdmin, asyncHandler(tenantController.activateTenant));
adminRouter.post('/organizations/:id/deactivate', universalJWTAuth, requireAdmin, asyncHandler(tenantController.deactivateTenant));
adminRouter.get('/organizations/:id/stats', universalJWTAuth, requireAdmin, asyncHandler(tenantController.getTenantStats));

// --- Plan & Feature Management ---
/**
 * @swagger
 * /api/plans:
 *   get:
 *     tags: [Plan Management]
 *     summary: Get all plans
 *     description: Retrieve all available subscription plans
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plan'
 */
adminRouter.get('/plans', universalJWTAuth, requireAdmin, asyncHandler(planController.getAllPlans));

/**
 * @swagger
 * /api/plans:
 *   post:
 *     tags: [Plan Management]
 *     summary: Create new plan
 *     description: Create a new subscription plan
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: Pro Plan
 *               description:
 *                 type: string
 *                 example: Professional plan with advanced features
 *               price:
 *                 type: number
 *                 format: float
 *                 example: 29.99
 *     responses:
 *       201:
 *         description: Plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plan'
 */
adminRouter.post('/plans', universalJWTAuth, requireAdmin, asyncHandler(planController.createPlan));

/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     tags: [Plan Management]
 *     summary: Get plan by ID
 *     description: Retrieve a specific plan by its ID
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plan'
 *       404:
 *         description: Plan not found
 */
adminRouter.get('/plans/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.getPlanById));

/**
 * @swagger
 * /api/plans/{id}:
 *   put:
 *     tags: [Plan Management]
 *     summary: Update plan
 *     description: Update an existing subscription plan
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 format: float
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plan'
 */
adminRouter.put('/plans/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.updatePlan));

/**
 * @swagger
 * /api/plans/{id}:
 *   delete:
 *     tags: [Plan Management]
 *     summary: Delete plan
 *     description: Delete a subscription plan
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan deleted successfully
 *       404:
 *         description: Plan not found
 */
adminRouter.delete('/plans/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.deletePlan));

/**
 * @swagger
 * /api/features:
 *   get:
 *     tags: [Plan Management]
 *     summary: Get all features
 *     description: Retrieve all available features
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Features retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Feature'
 */
adminRouter.get('/features', universalJWTAuth, requireAdmin, asyncHandler(planController.getAllFeatures));

/**
 * @swagger
 * /api/features:
 *   post:
 *     tags: [Plan Management]
 *     summary: Create new feature
 *     description: Create a new feature
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Advanced Analytics
 *               description:
 *                 type: string
 *                 example: Access to advanced analytics and reporting
 *     responses:
 *       201:
 *         description: Feature created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feature'
 */
adminRouter.post('/features', universalJWTAuth, requireAdmin, asyncHandler(planController.createFeature));
adminRouter.get('/features/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.getFeatureById));
adminRouter.put('/features/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.updateFeature));
adminRouter.delete('/features/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.deleteFeature));

adminRouter.post('/plans/:planId/features', universalJWTAuth, requireAdmin, asyncHandler(planController.addFeatureToPlan));
adminRouter.delete('/plans/:planId/features/:featureId', universalJWTAuth, requireAdmin, asyncHandler(planController.removeFeatureFromPlan));

// --- Global Permissions ---
adminRouter.get('/permissions/organizational', universalJWTAuth, requireAdmin, asyncHandler(planController.getOrganizationalPermissions));
adminRouter.post('/permissions/organizational', universalJWTAuth, requireAdmin, asyncHandler(planController.createOrganizationalPermission));
adminRouter.get('/permissions/workspace', universalJWTAuth, requireAdmin, asyncHandler(planController.getWorkspacePermissions));
adminRouter.post('/permissions/workspace', universalJWTAuth, requireAdmin, asyncHandler(planController.createWorkspacePermission));

// --- System Analytics & Audit ---
adminRouter.get('/analytics/system-usage', universalJWTAuth, requireAdmin, asyncHandler(analyticsController.getSystemUsage));
adminRouter.get('/analytics/organizations', universalJWTAuth, requireAdmin, asyncHandler(analyticsController.getOrganizationMetrics));
adminRouter.get('/audit-logs/system', universalJWTAuth, requireAdmin, asyncHandler(analyticsController.getSystemAuditLogs));

// Error handling middleware
adminRouter.use(errorHandler);

export default adminRouter;
