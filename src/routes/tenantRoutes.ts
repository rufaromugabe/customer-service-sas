// src/routes/tenantRoutes.ts
import { Router } from 'express';
import { tenantContext } from '../storage.ts';
import { 
    TenantController, 
    UserController, 
    WorkspaceController, 
    RoleController,
    AIController,
    ConversationController,
    AnalyticsController
} from '../controllers/index.ts';
import { 
    // Legacy auth middleware (keeping for backwards compatibility)
    authenticateUser, 
    // Universal JWT Auth middleware
    universalJWTAuth,
    requireTenantAccess,
    requireUser,
    asyncHandler,
    validateRequest
} from '../middleware/index.ts';
import { body, param } from 'express-validator';

const tenantRouter = Router();

// Middleware to ensure tenant context is available
tenantRouter.use((req, res, next) => {
    const tenantDB = tenantContext.getStore();
    if (!tenantDB) {
        return res.status(500).json({ message: 'Tenant context not established. Ensure /api/tenants/:tenantId is in path.' });
    }
    next();
});

// Initialize controllers
const tenantController = new TenantController();
const userController = new UserController();
const workspaceController = new WorkspaceController();
const roleController = new RoleController();
const aiController = new AIController();
const conversationController = new ConversationController();
const analyticsController = new AnalyticsController();

// --- Authentication & Profile (User-level) ---
// NOTE: Authentication routes have been moved to /api/auth/*
// These routes are kept for backwards compatibility but deprecated

/**
 * @swagger
 * /api/tenants/{tenantId}/auth/google:
 *   post:
 *     deprecated: true
 *     tags: [User Authentication]
 *     summary: Google OAuth login (DEPRECATED - use /api/auth/google)
 *     description: This endpoint is deprecated. Use /api/auth/google instead.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       301:
 *         description: Moved permanently - use /api/auth/google
 */
tenantRouter.post('/auth/google', (req, res) => {
    res.status(301).json({ 
        message: 'This endpoint has been moved to /api/auth/google',
        redirect: '/api/auth/google'
    });
});

/**
 * @swagger
 * /api/tenants/{tenantId}/auth/logout:
 *   post:
 *     deprecated: true
 *     tags: [User Authentication]
 *     summary: User logout (DEPRECATED - use /api/auth/signout)
 *     description: This endpoint is deprecated. Use /api/auth/signout instead.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       301:
 *         description: Moved permanently - use /api/auth/signout
 */
tenantRouter.post('/auth/logout', (req, res) => {
    res.status(301).json({ 
        message: 'This endpoint has been moved to /api/auth/signout',
        redirect: '/api/auth/signout'
    });
});

/**
 * @swagger
 * /api/tenants/{tenantId}/auth/me:
 *   get:
 *     deprecated: true
 *     tags: [User Authentication]
 *     summary: Get current user profile (DEPRECATED - use /api/auth/me)
 *     description: This endpoint is deprecated. Use /api/auth/me instead.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       301:
 *         description: Moved permanently - use /api/auth/me
 */
tenantRouter.get('/auth/me', (req, res) => {
    res.status(301).json({ 
        message: 'This endpoint has been moved to /api/auth/me',
        redirect: '/api/auth/me'
    });
});

/**
 * @swagger
 * /api/tenants/{tenantId}/auth/profile:
 *   put:
 *     deprecated: true
 *     tags: [User Authentication]
 *     summary: Update user profile (DEPRECATED - use /api/auth/profile)
 *     description: This endpoint is deprecated. Use /api/auth/profile instead.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       301:
 *         description: Moved permanently - use /api/auth/profile
 */
tenantRouter.put('/auth/profile', (req, res) => {
    res.status(301).json({ 
        message: 'This endpoint has been moved to /api/auth/profile',
        redirect: '/api/auth/profile'
    });
});

// --- User Management (Within a Tenant) ---
/**
 * @swagger
 * /api/tenants/{tenantId}/users:
 *   get:
 *     tags: [User Management]
 *     summary: Get all users in tenant
 *     description: Retrieve all users belonging to the specified tenant
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
tenantRouter.get('/:tenantId/users', 
    [param('tenantId').isUUID()],
    validateRequest,
    universalJWTAuth,
    requireTenantAccess,
    asyncHandler(userController.getTenantUsers.bind(userController))
);

/**
 * @swagger
 * /api/tenants/{tenantId}/users:
 *   post:
 *     tags: [User Management]
 *     summary: Add user to tenant
 *     description: Add a new user to the specified tenant
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
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
 *                 example: user@example.com
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional existing user ID
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of role IDs to assign
 *     responses:
 *       201:
 *         description: User added to tenant successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
tenantRouter.post('/:tenantId/users', 
    [
        param('tenantId').isUUID(),
        body('email').optional().isEmail(),
        body('userId').optional().isUUID(),
        body('roles').optional().isArray()
    ],
    validateRequest,
    universalJWTAuth,
    requireTenantAccess,
    asyncHandler(userController.addUserToTenant.bind(userController))
);

/**
 * @swagger
 * /api/tenants/{tenantId}/users/{id}:
 *   get:
 *     tags: [User Management]
 *     summary: Get specific user in tenant
 *     description: Retrieve a specific user by ID within the tenant
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
tenantRouter.get('/:tenantId/users/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(userController.getTenantUser.bind(userController))
);

tenantRouter.put('/:tenantId/users/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('roles').optional().isArray()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(userController.updateTenantUser.bind(userController))
);

tenantRouter.delete('/:tenantId/users/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(userController.removeUserFromTenant.bind(userController))
);

tenantRouter.put('/:tenantId/users/:id/activate', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('activate').isBoolean()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(userController.activateDeactivateUser.bind(userController))
);

// --- Workspace Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/workspaces', 
    [param('tenantId').isUUID()],
    validateRequest,
    universalJWTAuth,
    requireTenantAccess,
    asyncHandler(workspaceController.getWorkspaces.bind(workspaceController))
);

tenantRouter.post('/:tenantId/workspaces', 
    [
        param('tenantId').isUUID(),
        body('name').isString().notEmpty().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    universalJWTAuth,
    requireTenantAccess,
    asyncHandler(workspaceController.createWorkspace.bind(workspaceController))
);

tenantRouter.get('/:tenantId/workspaces/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(workspaceController.getWorkspace.bind(workspaceController))
);

tenantRouter.put('/:tenantId/workspaces/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('name').optional().isString().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(workspaceController.updateWorkspace.bind(workspaceController))
);

tenantRouter.delete('/:tenantId/workspaces/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(workspaceController.deleteWorkspace.bind(workspaceController))
);

tenantRouter.get('/:tenantId/workspaces/:id/users', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(workspaceController.getWorkspaceUsers.bind(workspaceController))
);

tenantRouter.post('/:tenantId/workspaces/:id/users', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('userId').isUUID(),
        body('roleId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(workspaceController.addUserToWorkspace.bind(workspaceController))
);

tenantRouter.delete('/:tenantId/workspaces/:id/users/:userId', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        param('userId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(workspaceController.removeUserFromWorkspace.bind(workspaceController))
);

// --- Role & Permission Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/roles', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.getRoles.bind(roleController))
);

tenantRouter.post('/:tenantId/roles', 
    [
        param('tenantId').isUUID(),
        body('name').isString().notEmpty().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.createRole.bind(roleController))
);

tenantRouter.put('/:tenantId/roles/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('name').optional().isString().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.updateRole.bind(roleController))
);

tenantRouter.delete('/:tenantId/roles/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.deleteRole.bind(roleController))
);

tenantRouter.get('/:tenantId/roles/:id/permissions', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.getRolePermissions.bind(roleController))
);

tenantRouter.post('/:tenantId/roles/:id/permissions', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('permissionId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.assignPermissionToRole.bind(roleController))
);

tenantRouter.delete('/:tenantId/roles/:id/permissions/:permId', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        param('permId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.removePermissionFromRole.bind(roleController))
);

tenantRouter.post('/:tenantId/users/:userId/roles', 
    [
        param('tenantId').isUUID(),
        param('userId').isUUID(),
        body('roleId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(userController.assignRoleToUser.bind(userController))
);

tenantRouter.delete('/:tenantId/users/:userId/roles/:roleId', 
    [
        param('tenantId').isUUID(),
        param('userId').isUUID(),
        param('roleId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(userController.removeRoleFromUser.bind(userController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/roles', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.getWorkspaceRoles.bind(roleController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/roles', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        body('name').isString().notEmpty().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.createWorkspaceRole.bind(roleController))
);

tenantRouter.put('/:tenantId/workspaces/:workspaceId/roles/:roleId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('roleId').isUUID(),
        body('name').optional().isString().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(roleController.updateWorkspaceRole.bind(roleController))
);


// --- Invitation Management ---
tenantRouter.get('/:tenantId/invitations', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(tenantController.getInvitations.bind(tenantController))
);

tenantRouter.post('/:tenantId/invitations', 
    [
        param('tenantId').isUUID(),
        body('email').isEmail()
    ],
    validateRequest,
    requireTenantAccess,
    authenticateUser,
    asyncHandler(tenantController.createInvitation.bind(tenantController))
);

/**
 * @swagger
 * /api/tenants/{tenantId}/invitations/{id}:
 *   delete:
 *     tags: [Invitation Management]
 *     summary: Cancel an invitation
 *     description: Revoke an existing invitation by ID
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invitation ID
 *     responses:
 *       200:
 *         description: Invitation canceled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation canceled
 *       404:
 *         description: Invitation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
tenantRouter.delete('/:tenantId/invitations/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(tenantController.cancelInvitation.bind(tenantController))
);

/**
 * @swagger
 * /api/tenants/{tenantId}/invitations/{id}/resend:
 *   post:
 *     tags: [Invitation Management]
 *     summary: Resend an invitation
 *     description: Resend an existing invitation by ID
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invitation ID
 *     responses:
 *       200:
 *         description: Invitation resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation resent
 *       404:
 *         description: Invitation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
tenantRouter.post('/:tenantId/invitations/:id/resend', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(tenantController.resendInvitation.bind(tenantController))
);

// --- Organization Settings (Tenant-specific) ---
tenantRouter.get('/:tenantId/organization', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(tenantController.getOrganization.bind(tenantController))
);

tenantRouter.put('/:tenantId/organization', 
    [
        param('tenantId').isUUID(),
        body('name').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(tenantController.updateOrganization.bind(tenantController))
);

tenantRouter.get('/:tenantId/organization/plan', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(tenantController.getOrganizationPlan.bind(tenantController))
);

tenantRouter.get('/:tenantId/organization/usage', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(tenantController.getOrganizationUsage.bind(tenantController))
);


// --- AI Customer Service System Specific Endpoints ---

// Customer Interactions (using 'todos' as per example)
tenantRouter.post('/:tenantId/customer-interactions', 
    [
        param('tenantId').isUUID(),
        body('title').isString().notEmpty(),
        body('complete').optional().isBoolean()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.createCustomerInteraction.bind(aiController))
);

tenantRouter.get('/:tenantId/customer-interactions', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getCustomerInteractions.bind(aiController))
);

// --- AI Agents/Bots Management (Within a Workspace) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/agents', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getAgents.bind(aiController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/agents', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        body('name').isString().notEmpty().trim(),
        body('description').optional().isString().trim(),
        body('model_config').optional().isObject()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.createAgent.bind(aiController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/agents/:agentId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getAgent.bind(aiController))
);

tenantRouter.put('/:tenantId/workspaces/:workspaceId/agents/:agentId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID(),
        body('name').optional().isString().trim(),
        body('description').optional().isString().trim(),
        body('model_config').optional().isObject(),
        body('status').optional().isString()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.updateAgent.bind(aiController))
);

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/agents/:agentId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.deleteAgent.bind(aiController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/agents/:agentId/activate', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID(),
        body('activate').isBoolean()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.activateDeactivateAgent.bind(aiController))
);

// --- Knowledge Base & Training Data (Within a Workspace for Agents) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getKnowledgeBases.bind(aiController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/knowledge-bases', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        body('name').isString().notEmpty().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.createKnowledgeBase.bind(aiController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getKnowledgeBase.bind(aiController))
);

tenantRouter.put('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID(),
        body('name').optional().isString().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.updateKnowledgeBase.bind(aiController))
);

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.deleteKnowledgeBase.bind(aiController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID(),
        body('title').isString().notEmpty().trim(),
        body('content').isString().notEmpty()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.uploadDocument.bind(aiController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getDocuments.bind(aiController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents/:docId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID(),
        param('docId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getDocument.bind(aiController))
);

tenantRouter.put('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents/:docId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID(),
        param('docId').isUUID(),
        body('title').optional().isString().trim(),
        body('content').optional().isString()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.updateDocument.bind(aiController))
);

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents/:docId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID(),
        param('docId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.deleteDocument.bind(aiController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/agents/:agentId/train', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.trainAgent.bind(aiController))
);

// --- Conversation & Interaction History (Within a Workspace) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(conversationController.getConversations.bind(conversationController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/conversations', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        body('customer_id').isString().notEmpty(),
        body('initial_message_content').isString().notEmpty(),
        body('agent_id').optional().isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(conversationController.createConversation.bind(conversationController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations/:conversationId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('conversationId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(conversationController.getConversation.bind(conversationController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations/:conversationId/messages', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('conversationId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(conversationController.getConversationMessages.bind(conversationController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/conversations/:conversationId/messages', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('conversationId').isUUID(),
        body('sender_type').isIn(['CUSTOMER', 'AGENT', 'HUMAN_AGENT']),
        body('content').isString().notEmpty()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(conversationController.addMessage.bind(conversationController))
);

// --- AI Model Configuration (Workspace Level) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/ai-settings', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.getAISettings.bind(aiController))
);

tenantRouter.put('/:tenantId/workspaces/:workspaceId/ai-settings', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        body('default_ai_model').optional().isString(),
        body('embedding_model').optional().isString(),
        body('temperature').optional().isFloat({ min: 0, max: 2 }),
        body('max_tokens').optional().isInt({ min: 1 })
    ],
    validateRequest,
    requireTenantAccess,
    asyncHandler(aiController.updateAISettings.bind(aiController))
);

// --- Reporting & Analytics (Tenant-Specific for AI Metrics) ---
tenantRouter.get('/:tenantId/analytics/agent-performance', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(analyticsController.getAgentPerformance.bind(analyticsController))
);

tenantRouter.get('/:tenantId/analytics/conversation-metrics', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(analyticsController.getConversationMetrics.bind(analyticsController))
);

tenantRouter.get('/:tenantId/audit-logs', 
    [param('tenantId').isUUID()],
    validateRequest,
    requireTenantAccess,
    asyncHandler(analyticsController.getAuditLogs.bind(analyticsController))
);

export default tenantRouter;
