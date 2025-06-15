import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AdminController, TenantController, PlanController, AnalyticsController } from '../controllers/index.ts';
import { authMiddleware, adminAuthMiddleware, errorHandler, asyncHandler } from '../middleware/index.ts';

const adminRouter = Router();
const prisma = new PrismaClient();

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
adminRouter.post('/auth/admin/login', asyncHandler(adminController.loginAdmin));
adminRouter.post('/auth/admin/logout', asyncHandler(adminController.logoutAdmin));
adminRouter.get('/auth/admin/me', authMiddleware, asyncHandler(adminController.getCurrentAdmin));

// Admin CRUD operations
adminRouter.get('/admins', adminAuthMiddleware, asyncHandler(adminController.getAllAdmins));
adminRouter.post('/admins', adminAuthMiddleware, asyncHandler(adminController.createAdmin));
adminRouter.get('/admins/:id', adminAuthMiddleware, asyncHandler(adminController.getAdminById));
adminRouter.put('/admins/:id', adminAuthMiddleware, asyncHandler(adminController.updateAdmin));
adminRouter.delete('/admins/:id', adminAuthMiddleware, asyncHandler(adminController.deleteAdmin));

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
adminRouter.get('/organizations', adminAuthMiddleware, asyncHandler(tenantController.getAllTenants));

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
adminRouter.post('/organizations', adminAuthMiddleware, asyncHandler(tenantController.createTenant));
adminRouter.get('/organizations/:id', adminAuthMiddleware, asyncHandler(tenantController.getTenantById));
adminRouter.put('/organizations/:id', adminAuthMiddleware, asyncHandler(tenantController.updateTenant));
adminRouter.delete('/organizations/:id', adminAuthMiddleware, asyncHandler(tenantController.deleteTenant));
adminRouter.post('/organizations/:id/activate', adminAuthMiddleware, asyncHandler(tenantController.activateTenant));
adminRouter.post('/organizations/:id/deactivate', adminAuthMiddleware, asyncHandler(tenantController.deactivateTenant));
adminRouter.get('/organizations/:id/stats', adminAuthMiddleware, asyncHandler(tenantController.getTenantStats));

// --- Plan & Feature Management ---
adminRouter.get('/plans', adminAuthMiddleware, asyncHandler(planController.getAllPlans));
adminRouter.post('/plans', adminAuthMiddleware, asyncHandler(planController.createPlan));
adminRouter.get('/plans/:id', adminAuthMiddleware, asyncHandler(planController.getPlanById));
adminRouter.put('/plans/:id', adminAuthMiddleware, asyncHandler(planController.updatePlan));
adminRouter.delete('/plans/:id', adminAuthMiddleware, asyncHandler(planController.deletePlan));

adminRouter.get('/features', adminAuthMiddleware, asyncHandler(planController.getAllFeatures));
adminRouter.post('/features', adminAuthMiddleware, asyncHandler(planController.createFeature));
adminRouter.get('/features/:id', adminAuthMiddleware, asyncHandler(planController.getFeatureById));
adminRouter.put('/features/:id', adminAuthMiddleware, asyncHandler(planController.updateFeature));
adminRouter.delete('/features/:id', adminAuthMiddleware, asyncHandler(planController.deleteFeature));

adminRouter.post('/plans/:planId/features', adminAuthMiddleware, asyncHandler(planController.addFeatureToPlan));
adminRouter.delete('/plans/:planId/features/:featureId', adminAuthMiddleware, asyncHandler(planController.removeFeatureFromPlan));

// --- Global Permissions ---
adminRouter.get('/permissions/organizational', adminAuthMiddleware, asyncHandler(planController.getOrganizationalPermissions));
adminRouter.post('/permissions/organizational', adminAuthMiddleware, asyncHandler(planController.createOrganizationalPermission));
adminRouter.get('/permissions/workspace', adminAuthMiddleware, asyncHandler(planController.getWorkspacePermissions));
adminRouter.post('/permissions/workspace', adminAuthMiddleware, asyncHandler(planController.createWorkspacePermission));

// --- System Analytics & Audit ---
adminRouter.get('/analytics/system-usage', adminAuthMiddleware, asyncHandler(analyticsController.getSystemUsage));
adminRouter.get('/analytics/organizations', adminAuthMiddleware, asyncHandler(analyticsController.getOrganizationMetrics));
adminRouter.get('/audit-logs/system', adminAuthMiddleware, asyncHandler(analyticsController.getSystemAuditLogs));

// Error handling middleware
adminRouter.use(errorHandler);

export default adminRouter;