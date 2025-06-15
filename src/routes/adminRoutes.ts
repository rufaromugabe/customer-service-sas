import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AdminController, TenantController, PlanController, AnalyticsController } from '../controllers/index.ts';
import { 
    authMiddleware, 
    adminAuthMiddleware, 
    errorHandler, 
    asyncHandler, 
    adminJWTMiddleware,
    adminLoginRateLimit,
    adminLoginSlowDown,
    adminAPIRateLimit,
    requireSuperAdmin,
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
// Health check endpoint
adminRouter.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'ai-customer-service-saas-backend'
    });
});

/**
 * @swagger
 * /api/db-status:
 *   get:
 *     tags: [Health]
 *     summary: Database connectivity check
 *     description: Tests the database connection and returns status
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
 */
// Database connection test endpoint
adminRouter.get('/db-status', async (req, res) => {
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
adminRouter.post('/auth/admin/logout', asyncHandler(adminController.logoutAdmin));

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
adminRouter.get('/auth/admin/me', adminJWTMiddleware, asyncHandler(adminController.getCurrentAdmin));

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
adminRouter.get('/admins', adminJWTMiddleware, asyncHandler(adminController.getAllAdmins));

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
    adminJWTMiddleware, 
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
adminRouter.get('/admins/:id', adminJWTMiddleware, asyncHandler(adminController.getAdminById));

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
    adminJWTMiddleware, 
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
    adminJWTMiddleware, 
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
adminRouter.get('/organizations', adminJWTMiddleware, asyncHandler(tenantController.getAllTenants));

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
adminRouter.post('/organizations', adminJWTMiddleware, asyncHandler(tenantController.createTenant));
adminRouter.get('/organizations/:id', adminJWTMiddleware, asyncHandler(tenantController.getTenantById));
adminRouter.put('/organizations/:id', adminJWTMiddleware, asyncHandler(tenantController.updateTenant));
adminRouter.delete('/organizations/:id', adminJWTMiddleware, requireSuperAdmin, ...sensitiveOperationSecurity, asyncHandler(tenantController.deleteTenant));
adminRouter.post('/organizations/:id/activate', adminJWTMiddleware, asyncHandler(tenantController.activateTenant));
adminRouter.post('/organizations/:id/deactivate', adminJWTMiddleware, asyncHandler(tenantController.deactivateTenant));
adminRouter.get('/organizations/:id/stats', adminJWTMiddleware, asyncHandler(tenantController.getTenantStats));

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
adminRouter.get('/plans', adminJWTMiddleware, asyncHandler(planController.getAllPlans));

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
adminRouter.post('/plans', adminJWTMiddleware, asyncHandler(planController.createPlan));

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
adminRouter.get('/plans/:id', adminJWTMiddleware, asyncHandler(planController.getPlanById));

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
adminRouter.put('/plans/:id', adminJWTMiddleware, asyncHandler(planController.updatePlan));

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
adminRouter.delete('/plans/:id', adminJWTMiddleware, asyncHandler(planController.deletePlan));

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
adminRouter.get('/features', adminJWTMiddleware, asyncHandler(planController.getAllFeatures));

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
adminRouter.post('/features', adminJWTMiddleware, asyncHandler(planController.createFeature));
adminRouter.get('/features/:id', adminJWTMiddleware, asyncHandler(planController.getFeatureById));
adminRouter.put('/features/:id', adminJWTMiddleware, asyncHandler(planController.updateFeature));
adminRouter.delete('/features/:id', adminJWTMiddleware, asyncHandler(planController.deleteFeature));

adminRouter.post('/plans/:planId/features', adminJWTMiddleware, asyncHandler(planController.addFeatureToPlan));
adminRouter.delete('/plans/:planId/features/:featureId', adminJWTMiddleware, asyncHandler(planController.removeFeatureFromPlan));

// --- Global Permissions ---
adminRouter.get('/permissions/organizational', adminJWTMiddleware, asyncHandler(planController.getOrganizationalPermissions));
adminRouter.post('/permissions/organizational', adminJWTMiddleware, asyncHandler(planController.createOrganizationalPermission));
adminRouter.get('/permissions/workspace', adminJWTMiddleware, asyncHandler(planController.getWorkspacePermissions));
adminRouter.post('/permissions/workspace', adminJWTMiddleware, asyncHandler(planController.createWorkspacePermission));

// --- System Analytics & Audit ---
adminRouter.get('/analytics/system-usage', adminJWTMiddleware, asyncHandler(analyticsController.getSystemUsage));
adminRouter.get('/analytics/organizations', adminJWTMiddleware, asyncHandler(analyticsController.getOrganizationMetrics));
adminRouter.get('/audit-logs/system', adminJWTMiddleware, asyncHandler(analyticsController.getSystemAuditLogs));

// Error handling middleware
adminRouter.use(errorHandler);

export default adminRouter;