// src/routes/tenantRoutes.ts
import { Router } from 'express';
import { tenantContext } from '../storage.js';
import { 
    TenantController, 
    UserController, 
    WorkspaceController, 
    RoleController,
    AIController,
    ConversationController,
    AnalyticsController
} from '../controllers/index.js';
import { 
    authenticateUser, 
    validateTenantAccess, 
    asyncHandler,
    validateRequest
} from '../middleware/index.js';
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
/**
 * @swagger
 * /api/tenants/{tenantId}/auth/google:
 *   post:
 *     tags: [User Authentication]
 *     summary: Google OAuth login (placeholder)
 *     description: Placeholder endpoint for Google OAuth login flow
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       501:
 *         description: Not implemented
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
tenantRouter.post('/auth/google', asyncHandler(userController.googleAuth.bind(userController)));

tenantRouter.post('/auth/logout', asyncHandler(userController.logout.bind(userController)));

/**
 * @swagger
 * /api/tenants/{tenantId}/auth/me:
 *   get:
 *     tags: [User Authentication]
 *     summary: Get current user profile
 *     description: Retrieve the current authenticated user's profile information
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
tenantRouter.get('/auth/me', authenticateUser, asyncHandler(userController.getCurrentUser.bind(userController)));

tenantRouter.put('/auth/profile', 
    authenticateUser,
    [
        body('name').optional().isString().trim(),
        body('family_name').optional().isString().trim(),
        body('given_name').optional().isString().trim(),
        body('picture').optional().isString().trim()
    ],
    validateRequest,
    asyncHandler(userController.updateProfile.bind(userController))
);

// --- User Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/users', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.getTenantUsers.bind(userController))
);

tenantRouter.post('/:tenantId/users', 
    [
        param('tenantId').isUUID(),
        body('email').optional().isEmail(),
        body('userId').optional().isUUID(),
        body('roles').optional().isArray()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.addUserToTenant.bind(userController))
);

tenantRouter.get('/:tenantId/users/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.getTenantUser.bind(userController))
);

tenantRouter.put('/:tenantId/users/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('roles').optional().isArray()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.updateTenantUser.bind(userController))
);

tenantRouter.delete('/:tenantId/users/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.removeUserFromTenant.bind(userController))
);

tenantRouter.put('/:tenantId/users/:id/activate', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('activate').isBoolean()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.activateDeactivateUser.bind(userController))
);

// --- Workspace Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/workspaces', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(workspaceController.getWorkspaces.bind(workspaceController))
);

tenantRouter.post('/:tenantId/workspaces', 
    [
        param('tenantId').isUUID(),
        body('name').isString().notEmpty().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(workspaceController.createWorkspace.bind(workspaceController))
);

tenantRouter.get('/:tenantId/workspaces/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(workspaceController.updateWorkspace.bind(workspaceController))
);

tenantRouter.delete('/:tenantId/workspaces/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(workspaceController.deleteWorkspace.bind(workspaceController))
);

tenantRouter.get('/:tenantId/workspaces/:id/users', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(workspaceController.addUserToWorkspace.bind(workspaceController))
);

tenantRouter.delete('/:tenantId/workspaces/:id/users/:userId', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        param('userId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(workspaceController.removeUserFromWorkspace.bind(workspaceController))
);

// --- Role & Permission Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/roles', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(roleController.getRoles.bind(roleController))
);

tenantRouter.post('/:tenantId/roles', 
    [
        param('tenantId').isUUID(),
        body('name').isString().notEmpty().trim(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(roleController.updateRole.bind(roleController))
);

tenantRouter.delete('/:tenantId/roles/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(roleController.deleteRole.bind(roleController))
);

tenantRouter.get('/:tenantId/roles/:id/permissions', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(roleController.getRolePermissions.bind(roleController))
);

tenantRouter.post('/:tenantId/roles/:id/permissions', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        body('permissionId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(roleController.assignPermissionToRole.bind(roleController))
);

tenantRouter.delete('/:tenantId/roles/:id/permissions/:permId', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID(),
        param('permId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(roleController.removePermissionFromRole.bind(roleController))
);

tenantRouter.post('/:tenantId/users/:userId/roles', 
    [
        param('tenantId').isUUID(),
        param('userId').isUUID(),
        body('roleId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.assignRoleToUser.bind(userController))
);

tenantRouter.delete('/:tenantId/users/:userId/roles/:roleId', 
    [
        param('tenantId').isUUID(),
        param('userId').isUUID(),
        param('roleId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(userController.removeRoleFromUser.bind(userController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/roles', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(roleController.updateWorkspaceRole.bind(roleController))
);


// --- Invitation Management ---
tenantRouter.get('/:tenantId/invitations', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(tenantController.getInvitations.bind(tenantController))
);

tenantRouter.post('/:tenantId/invitations', 
    [
        param('tenantId').isUUID(),
        body('email').isEmail()
    ],
    validateRequest,
    validateTenantAccess,
    authenticateUser,
    asyncHandler(tenantController.createInvitation.bind(tenantController))
);

// Public endpoint for invitation details (does not require tenant context via path)
tenantRouter.get('/invitations/:token', 
    [param('token').isUUID()],
    validateRequest,
    asyncHandler(tenantController.getInvitationDetails.bind(tenantController))
);

// Public endpoint for accepting invitation (does not require tenant context via path)
tenantRouter.post('/invitations/:token/accept', 
    [
        param('token').isUUID(),
        body('userId').optional().isUUID()
    ],
    validateRequest,
    asyncHandler(tenantController.acceptInvitation.bind(tenantController))
);

tenantRouter.delete('/:tenantId/invitations/:id', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(tenantController.cancelInvitation.bind(tenantController))
);

tenantRouter.post('/:tenantId/invitations/:id/resend', 
    [
        param('tenantId').isUUID(),
        param('id').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(tenantController.resendInvitation.bind(tenantController))
);

// --- Organization Settings (Tenant-specific) ---
tenantRouter.get('/:tenantId/organization', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(tenantController.getOrganization.bind(tenantController))
);

tenantRouter.put('/:tenantId/organization', 
    [
        param('tenantId').isUUID(),
        body('name').optional().isString().trim()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(tenantController.updateOrganization.bind(tenantController))
);

tenantRouter.get('/:tenantId/organization/plan', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(tenantController.getOrganizationPlan.bind(tenantController))
);

tenantRouter.get('/:tenantId/organization/usage', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.createCustomerInteraction.bind(aiController))
);

tenantRouter.get('/:tenantId/customer-interactions', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(aiController.getCustomerInteractions.bind(aiController))
);

// --- AI Agents/Bots Management (Within a Workspace) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/agents', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.createAgent.bind(aiController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/agents/:agentId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.updateAgent.bind(aiController))
);

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/agents/:agentId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.activateDeactivateAgent.bind(aiController))
);

// --- Knowledge Base & Training Data (Within a Workspace for Agents) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.createKnowledgeBase.bind(aiController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.updateKnowledgeBase.bind(aiController))
);

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.uploadDocument.bind(aiController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('kbId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
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
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.deleteDocument.bind(aiController))
);

tenantRouter.post('/:tenantId/workspaces/:workspaceId/agents/:agentId/train', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('agentId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(aiController.trainAgent.bind(aiController))
);

// --- Conversation & Interaction History (Within a Workspace) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(conversationController.createConversation.bind(conversationController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations/:conversationId', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('conversationId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
    asyncHandler(conversationController.getConversation.bind(conversationController))
);

tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations/:conversationId/messages', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID(),
        param('conversationId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(conversationController.addMessage.bind(conversationController))
);

// --- AI Model Configuration (Workspace Level) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/ai-settings', 
    [
        param('tenantId').isUUID(),
        param('workspaceId').isUUID()
    ],
    validateRequest,
    validateTenantAccess,
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
    validateTenantAccess,
    asyncHandler(aiController.updateAISettings.bind(aiController))
);

// --- Reporting & Analytics (Tenant-Specific for AI Metrics) ---
tenantRouter.get('/:tenantId/analytics/agent-performance', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(analyticsController.getAgentPerformance.bind(analyticsController))
);

tenantRouter.get('/:tenantId/analytics/conversation-metrics', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(analyticsController.getConversationMetrics.bind(analyticsController))
);

tenantRouter.get('/:tenantId/audit-logs', 
    [param('tenantId').isUUID()],
    validateRequest,
    validateTenantAccess,
    asyncHandler(analyticsController.getAuditLogs.bind(analyticsController))
);

export default tenantRouter;