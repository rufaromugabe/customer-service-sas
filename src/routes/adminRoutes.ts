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
 *     tags: 
 *       - Health
 *     summary: Health check endpoint
 *     description: Returns the health status of the API. Requires admin authentication.
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       401:
 *         description: Unauthorized
 */
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
 *     tags: 
 *       - Health
 *     summary: Public health check endpoint
 *     description: Returns the health status of the API (minimal info).
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
 *     tags: 
 *       - Health
 *     summary: Database connectivity check (Admin only)
 *     description: Tests the database connection and returns status. Requires admin authentication.
 *     security:
 *       - universalAuth: []
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
 *     tags: 
 *       - Admin Authentication
 *     summary: Admin login
 *     description: Authenticate an admin user and receive access and refresh tokens.
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
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful. Returns tokens.
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
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
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
 *     tags: 
 *       - Admin Authentication
 *     summary: Admin logout
 *     description: Log out the current authenticated admin user by invalidating their tokens.
 *     security:
 *       - universalAuth: []
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
 *     tags: 
 *       - Admin Authentication
 *     summary: Get current admin profile
 *     description: Retrieve the current authenticated admin's profile information.
 *     security:
 *       - universalAuth: []
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
 *     tags: 
 *       - Admin Authentication
 *     summary: Refresh admin access token
 *     description: Use a valid refresh token (sent via cookie) to get a new access token.
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
adminRouter.post('/auth/admin/refresh', asyncHandler(adminController.refreshToken));

/**
 * @swagger
 * /api/auth/admin/revoke-all:
 *   post:
 *     tags: 
 *       - Admin Authentication
 *     summary: Revoke all admin tokens
 *     description: Revoke all active tokens for the current admin (logout from all devices).
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: All tokens revoked successfully
 *       401:
 *         description: Unauthorized
 */
adminRouter.post('/auth/admin/revoke-all', universalJWTAuth, requireAdmin, asyncHandler(adminController.revokeAllTokens));

// --- Admin CRUD operations ---
/**
 * @swagger
 * /api/admins:
 *   get:
 *     tags: 
 *       - Admin Management
 *     summary: Get all admins
 *     description: Retrieve a list of all admin users. Requires admin privileges.
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: A list of admins.
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
 *     tags: 
 *       - Admin Management
 *     summary: Create a new admin
 *     description: Create a new admin user. Requires Super Admin privileges.
 *     security:
 *       - universalAuth: []
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
 *                 example: new.admin@example.com
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securepassword123
 *     responses:
 *       201:
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       403:
 *         description: Forbidden - Super Admin required
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
 *     tags: 
 *       - Admin Management
 *     summary: Get admin by ID
 *     description: Retrieve a specific admin by their ID.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Admin ID
 *     responses:
 *       200:
 *         description: Admin details
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
 *     tags: 
 *       - Admin Management
 *     summary: Update an admin
 *     description: Update an existing admin user's details.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Admin ID
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
 *                 format: password
 *                 description: Provide a new password to change it.
 *     responses:
 *       200:
 *         description: Admin updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       404:
 *         description: Admin not found
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
 *     tags: 
 *       - Admin Management
 *     summary: Delete an admin
 *     description: Delete an admin user. Requires Super Admin privileges.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Admin ID
 *     responses:
 *       200:
 *         description: Admin deleted successfully
 *       404:
 *         description: Admin not found
 *       403:
 *         description: Forbidden - Super Admin required
 */
adminRouter.delete('/admins/:id', 
    universalJWTAuth, requireAdmin, 
    requireSuperAdmin, 
    ...sensitiveOperationSecurity, 
    asyncHandler(adminController.deleteAdmin)
);

// --- Tenant (Organization) Management ---
/**
 * @swagger
 * /api/organizations:
 *   get:
 *     tags: 
 *       - Tenant Management
 *     summary: List all tenants
 *     description: Retrieve a list of all tenant organizations. Requires admin privileges.
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: A list of tenants.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tenant'
 */
adminRouter.get('/organizations', universalJWTAuth, requireAdmin, asyncHandler(tenantController.getAllTenants));

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     tags: 
 *       - Tenant Management
 *     summary: Create a new tenant
 *     description: Create a new tenant organization. Requires admin privileges.
 *     security:
 *       - universalAuth: []
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
 *                 description: Optional custom ID for the tenant.
 *               current_plan_id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional plan ID to assign upon creation.
 *     responses:
 *       201:
 *         description: Tenant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tenant'
 */
adminRouter.post('/organizations', universalJWTAuth, requireAdmin, asyncHandler(tenantController.createTenant));

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     tags: 
 *       - Tenant Management
 *     summary: Get tenant by ID
 *     description: Retrieve a specific tenant by their ID.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Tenant ID
 *     responses:
 *       200:
 *         description: Tenant details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tenant'
 *       404:
 *         description: Tenant not found
 */
adminRouter.get('/organizations/:id', universalJWTAuth, requireAdmin, asyncHandler(tenantController.getTenantById));

/**
 * @swagger
 * /api/organizations/{id}:
 *   put:
 *     tags: 
 *       - Tenant Management
 *     summary: Update a tenant
 *     description: Update an existing tenant's details.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Tenant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTenantDto'
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tenant'
 *       404:
 *         description: Tenant not found
 */
adminRouter.put('/organizations/:id', universalJWTAuth, requireAdmin, asyncHandler(tenantController.updateTenant));

/**
 * @swagger
 * /api/organizations/{id}:
 *   delete:
 *     tags: 
 *       - Tenant Management
 *     summary: Delete a tenant
 *     description: Permanently delete a tenant and all associated data. Requires Super Admin privileges.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Tenant ID
 *     responses:
 *       200:
 *         description: Tenant deleted successfully
 *       404:
 *         description: Tenant not found
 *       403:
 *         description: Forbidden - Super Admin required
 */
adminRouter.delete('/organizations/:id', universalJWTAuth, requireAdmin, requireSuperAdmin, ...sensitiveOperationSecurity, asyncHandler(tenantController.deleteTenant));

/**
 * @swagger
 * /api/organizations/{id}/activate:
 *   post:
 *     tags: 
 *       - Tenant Management
 *     summary: Activate a tenant
 *     description: Set a tenant's status to active.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Tenant ID
 *     responses:
 *       200:
 *         description: Tenant activated successfully
 *       404:
 *         description: Tenant not found
 */
adminRouter.post('/organizations/:id/activate', universalJWTAuth, requireAdmin, asyncHandler(tenantController.activateTenant));

/**
 * @swagger
 * /api/organizations/{id}/deactivate:
 *   post:
 *     tags: 
 *       - Tenant Management
 *     summary: Deactivate a tenant
 *     description: Set a tenant's status to inactive.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Tenant ID
 *     responses:
 *       200:
 *         description: Tenant deactivated successfully
 *       404:
 *         description: Tenant not found
 */
adminRouter.post('/organizations/:id/deactivate', universalJWTAuth, requireAdmin, asyncHandler(tenantController.deactivateTenant));

/**
 * @swagger
 * /api/organizations/{id}/stats:
 *   get:
 *     tags: 
 *       - Tenant Management
 *     summary: Get tenant statistics
 *     description: Retrieve usage statistics for a specific tenant.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Tenant ID
 *     responses:
 *       200:
 *         description: Tenant statistics retrieved successfully
 *       404:
 *         description: Tenant not found
 */
adminRouter.get('/organizations/:id/stats', universalJWTAuth, requireAdmin, asyncHandler(tenantController.getTenantStats));

// --- Plan & Feature Management ---
/**
 * @swagger
 * /api/plans:
 *   get:
 *     tags: 
 *       - Plan Management
 *     summary: Get all plans
 *     description: Retrieve all available subscription plans.
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: A list of plans.
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
 *     tags: 
 *       - Plan Management
 *     summary: Create a new plan
 *     description: Create a new subscription plan.
 *     security:
 *       - universalAuth: []
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
 *                 example: Professional plan with advanced features.
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
 *     tags: 
 *       - Plan Management
 *     summary: Get plan by ID
 *     description: Retrieve a specific plan by its ID.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Plan ID
 *     responses:
 *       200:
 *         description: Plan details
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
 *     tags: 
 *       - Plan Management
 *     summary: Update a plan
 *     description: Update an existing subscription plan.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Plan ID
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
 *     tags: 
 *       - Plan Management
 *     summary: Delete a plan
 *     description: Delete a subscription plan.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Plan ID
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
 *     tags: 
 *       - Plan Management
 *     summary: Get all features
 *     description: Retrieve all available features that can be assigned to plans.
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: A list of features.
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
 *     tags: 
 *       - Plan Management
 *     summary: Create a new feature
 *     description: Create a new feature.
 *     security:
 *       - universalAuth: []
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
 *                 example: Access to advanced analytics and reporting.
 *     responses:
 *       201:
 *         description: Feature created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feature'
 */
adminRouter.post('/features', universalJWTAuth, requireAdmin, asyncHandler(planController.createFeature));

/**
 * @swagger
 * /api/features/{id}:
 *   get:
 *     tags: 
 *       - Plan Management
 *     summary: Get feature by ID
 *     description: Retrieve a specific feature by its ID.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Feature ID
 *     responses:
 *       200:
 *         description: Feature details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feature'
 *       404:
 *         description: Feature not found
 */
adminRouter.get('/features/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.getFeatureById));

/**
 * @swagger
 * /api/features/{id}:
 *   put:
 *     tags: 
 *       - Plan Management
 *     summary: Update a feature
 *     description: Update an existing feature's details.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Feature ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFeatureDto'
 *     responses:
 *       200:
 *         description: Feature updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feature'
 *       404:
 *         description: Feature not found
 */
adminRouter.put('/features/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.updateFeature));

/**
 * @swagger
 * /api/features/{id}:
 *   delete:
 *     tags: 
 *       - Plan Management
 *     summary: Delete a feature
 *     description: Delete a feature.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Feature ID
 *     responses:
 *       200:
 *         description: Feature deleted successfully
 *       404:
 *         description: Feature not found
 */
adminRouter.delete('/features/:id', universalJWTAuth, requireAdmin, asyncHandler(planController.deleteFeature));

/**
 * @swagger
 * /api/plans/{planId}/features:
 *   post:
 *     tags: 
 *       - Plan Management
 *     summary: Add feature to plan
 *     description: Associate an existing feature with a subscription plan.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - featureId
 *             properties:
 *               featureId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Feature added to plan successfully
 *       404:
 *         description: Plan or Feature not found
 */
adminRouter.post('/plans/:planId/features', universalJWTAuth, requireAdmin, asyncHandler(planController.addFeatureToPlan));

/**
 * @swagger
 * /api/plans/{planId}/features/{featureId}:
 *   delete:
 *     tags: 
 *       - Plan Management
 *     summary: Remove feature from plan
 *     description: Disassociate a feature from a subscription plan.
 *     security:
 *       - universalAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Plan ID
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Feature ID
 *     responses:
 *       200:
 *         description: Feature removed from plan successfully
 *       404:
 *         description: Plan, Feature, or association not found
 */
adminRouter.delete('/plans/:planId/features/:featureId', universalJWTAuth, requireAdmin, asyncHandler(planController.removeFeatureFromPlan));

// --- Global Permissions ---
/**
 * @swagger
 * /api/permissions/organizational:
 *   get:
 *     tags:
 *       - Permissions
 *     summary: Get all organizational permissions
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: List of organizational permissions
 */
adminRouter.get('/permissions/organizational', universalJWTAuth, requireAdmin, asyncHandler(planController.getOrganizationalPermissions));

/**
 * @swagger
 * /api/permissions/organizational:
 *   post:
 *     tags:
 *       - Permissions
 *     summary: Create an organizational permission
 *     security:
 *       - universalAuth: []
 *     responses:
 *       201:
 *         description: Permission created
 */
adminRouter.post('/permissions/organizational', universalJWTAuth, requireAdmin, asyncHandler(planController.createOrganizationalPermission));

/**
 * @swagger
 * /api/permissions/workspace:
 *   get:
 *     tags:
 *       - Permissions
 *     summary: Get all workspace permissions
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: List of workspace permissions
 */
adminRouter.get('/permissions/workspace', universalJWTAuth, requireAdmin, asyncHandler(planController.getWorkspacePermissions));

/**
 * @swagger
 * /api/permissions/workspace:
 *   post:
 *     tags:
 *       - Permissions
 *     summary: Create a workspace permission
 *     security:
 *       - universalAuth: []
 *     responses:
 *       201:
 *         description: Permission created
 */
adminRouter.post('/permissions/workspace', universalJWTAuth, requireAdmin, asyncHandler(planController.createWorkspacePermission));

// --- System Analytics & Audit ---
/**
 * @swagger
 * /api/analytics/system-usage:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get system-wide usage statistics
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: System usage data
 */
adminRouter.get('/analytics/system-usage', universalJWTAuth, requireAdmin, asyncHandler(analyticsController.getSystemUsage));

/**
 * @swagger
 * /api/analytics/organizations:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get metrics for all organizations
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: Aggregated organization metrics
 */
adminRouter.get('/analytics/organizations', universalJWTAuth, requireAdmin, asyncHandler(analyticsController.getOrganizationMetrics));

/**
 * @swagger
 * /api/audit-logs/system:
 *   get:
 *     tags:
 *       - Audit
 *     summary: Get system-level audit logs
 *     security:
 *       - universalAuth: []
 *     responses:
 *       200:
 *         description: A list of system audit log entries
 */
adminRouter.get('/audit-logs/system', universalJWTAuth, requireAdmin, asyncHandler(analyticsController.getSystemAuditLogs));

// Error handling middleware
adminRouter.use(errorHandler);

export default adminRouter;