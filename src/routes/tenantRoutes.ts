// src/routes/tenantRoutes.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from '../storage.js';
import { v4 as uuidv4 } from 'uuid';
import { findSimilarCustomerInteractions, aiEstimate, embedTask, EmbeddingTasks, embeddingToSQL } from '../AiUtils.js';

const tenantRouter = Router();

// Middleware to ensure tenant context is available
tenantRouter.use((req, res, next) => {
    const tenantDB = tenantContext.getStore();
    if (!tenantDB) {
        return res.status(500).json({ message: 'Tenant context not established. Ensure /api/tenants/:tenantId is in path.' });
    }
    next();
});

// --- Authentication & Profile (User-level) ---
// Note: Google OAuth login would typically be handled by a specific OAuth flow
// and not directly exposed as a simple POST, but for demo, we keep the endpoint.
tenantRouter.post('/auth/google', async (req, res) => {
    // This endpoint would initiate or complete a Google OAuth flow
    // and create/authenticate a user in the 'users' schema.
    // It's not tenant-specific in its initial call, but the resulting user
    // would then be associated with one or more tenants.
    res.status(501).json({ message: 'Google OAuth login not fully implemented in this demo.' });
});

tenantRouter.post('/auth/logout', (req, res) => {
    // Invalidate session/JWT for the user
    res.json({ message: 'User logged out successfully.' });
});

tenantRouter.get('/auth/me', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    // This typically retrieves the current user based on a JWT or session from headers
    // For basic auth demo, assume req.auth.user is the user ID
    if (req.auth && req.auth.user) {
        try {
            const user = await tenantDB?.users.findUnique({
                where: { id: req.auth.user },
                select: { id: true, email: true, name: true, given_name: true, family_name: true, picture: true, created: true }
            });
            if (user) {
                return res.json(user);
            }
        } catch (error: any) {
            console.error('Error fetching current user info:', error);
        }
    }
    res.status(401).json({ message: 'Unauthorized or user not found.' });
});

tenantRouter.put('/auth/profile', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    if (!req.auth || !req.auth.user) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }
    const { name, family_name, given_name, picture } = req.body;
    try {
        const updatedUser = await tenantDB?.users.update({
            where: { id: req.auth.user },
            data: { name, family_name, given_name, picture }
        });
        if (updatedUser) {
            const { deleted, ...userInfo } = updatedUser; // Exclude sensitive/unnecessary fields
            return res.json(userInfo);
        }
        res.status(404).json({ message: 'User not found.' });
    } catch (error: any) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- User Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/users', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        // Nile's RLS will automatically filter by tenant_id when querying 'tenant_users'
        const tenantUsers = await tenantDB?.tenant_users.findMany({
            where: { tenant_id: req.params.tenantId },
            include: { user: {
                select: { id: true, name: true, email: true, picture: true }
            }}
        });
        res.json(tenantUsers);
    } catch (error: any) {
        console.error('Error listing tenant users:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});

tenantRouter.post('/:tenantId/users', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { email, userId, roles } = req.body; // userId is for existing users, email for new invitations
    try {
        let existingUser = null;
        if (userId) {
            existingUser = await tenantDB?.users.findUnique({ where: { id: userId } });
        } else if (email) {
            existingUser = await tenantDB?.users.findUnique({ where: { email } });
        }

        let user_id_to_associate;
        if (existingUser) {
            user_id_to_associate = existingUser.id;
        } else if (email) {
            // Create a new user in the global users schema if not found and email is provided
            const newUser = await (tenantDB as PrismaClient).users.create({
                data: { email, name: email.split('@')[0] } // Basic name from email
            });
            user_id_to_associate = newUser.id;
        } else {
            return res.status(400).json({ message: 'Either userId or email is required to add/invite a user.' });
        }

        // Associate user with the tenant
        const newTenantUser = await tenantDB?.tenant_users.create({
            data: {
                tenant_id: req.params.tenantId,
                user_id: user_id_to_associate,
                email: email || existingUser?.email,
                roles: roles || []
            }
        });
        res.status(201).json(newTenantUser);
    } catch (error: any) {
        console.error('Error adding user to tenant:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});

tenantRouter.get('/:tenantId/users/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const tenantUser = await tenantDB?.tenant_users.findUnique({
            where: {
                tenant_id_user_id: {
                    tenant_id: req.params.tenantId,
                    user_id: req.params.id
                }
            },
            include: { user: true }
        });
        if (!tenantUser) {
            return res.status(404).json({ message: 'User not found in this tenant.' });
        }
        res.json(tenantUser);
    } catch (error: any) {
        console.error('Error getting tenant user details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/users/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { roles } = req.body; // Can only update tenant-specific roles here, or other tenant_user fields
    try {
        const updatedTenantUser = await tenantDB?.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: req.params.tenantId,
                    user_id: req.params.id
                }
            },
            data: { roles: roles || undefined }
        });
        res.json(updatedTenantUser);
    } catch (error: any) {
        console.error('Error updating tenant user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/users/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        // Soft delete the association
        await tenantDB?.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: req.params.tenantId,
                    user_id: req.params.id
                }
            },
            data: { deleted: new Date() }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error soft deleting user from tenant:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/users/:id/activate', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { activate } = req.body; // boolean
    try {
        await tenantDB?.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: req.params.tenantId,
                    user_id: req.params.id
                }
            },
            data: { deleted: activate ? null : new Date() } // activate means set deleted to null
        });
        res.status(200).json({ message: `User ${activate ? 'activated' : 'deactivated'} in tenant.` });
    } catch (error: any) {
        console.error('Error activating/deactivating user in tenant:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Workspace Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/workspaces', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const workspaces = await tenantDB?.workspaces.findMany({
            where: { tenant_id: req.params.tenantId }
        });
        res.json(workspaces);
    } catch (error: any) {
        console.error('Error listing workspaces:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Workspace name is required.' });
    try {
        const newWorkspace = await tenantDB?.workspaces.create({
            data: { tenant_id: req.params.tenantId, name, description }
        });
        res.status(201).json(newWorkspace);
    } catch (error: any) {
        console.error('Error creating workspace:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/workspaces/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const workspace = await tenantDB?.workspaces.findUnique({
            where: {
                tenant_id_id: {
                    tenant_id: req.params.tenantId,
                    id: req.params.id
                }
            }
        });
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found.' });
        }
        res.json(workspace);
    } catch (error: any) {
        console.error('Error getting workspace details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/workspaces/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    try {
        const updatedWorkspace = await tenantDB?.workspaces.update({
            where: {
                tenant_id_id: {
                    tenant_id: req.params.tenantId,
                    id: req.params.id
                }
            },
            data: { name, description }
        });
        res.json(updatedWorkspace);
    }
    catch (error: any) {
        console.error('Error updating workspace:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/workspaces/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.workspaces.update({
            where: {
                tenant_id_id: {
                    tenant_id: req.params.tenantId,
                    id: req.params.id
                }
            },
            data: { deleted: new Date() }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting workspace:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/workspaces/:id/users', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const workspaceUsers = await tenantDB?.workspace_users.findMany({
            where: { tenant_id: req.params.tenantId, workspace_id: req.params.id },
            include: { user: { select: { id: true, name: true, email: true } }, role: { select: { name: true } } }
        });
        res.json(workspaceUsers);
    } catch (error: any) {
        console.error('Error listing workspace users:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:id/users', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { userId, roleId } = req.body;
    if (!userId || !roleId) return res.status(400).json({ message: 'User ID and Role ID are required.' });
    try {
        const newWorkspaceUser = await tenantDB?.workspace_users.create({
            data: {
                tenant_id: req.params.tenantId,
                workspace_id: req.params.id,
                user_id: userId,
                role_id: roleId
            }
        });
        res.status(201).json(newWorkspaceUser);
    } catch (error: any) {
        console.error('Error adding user to workspace:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});

tenantRouter.delete('/:tenantId/workspaces/:id/users/:userId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.workspace_users.delete({
            where: {
                workspace_id_user_id: {
                    workspace_id: req.params.id,
                    user_id: req.params.userId
                }
            }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error removing user from workspace:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Role & Permission Management (Within a Tenant) ---
tenantRouter.get('/:tenantId/roles', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const roles = await tenantDB?.roles.findMany({
            where: { tenant_id: req.params.tenantId }
        });
        res.json(roles);
    } catch (error: any) {
        console.error('Error listing tenant roles:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/roles', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Role name is required.' });
    try {
        const newRole = await tenantDB?.roles.create({
            data: { tenant_id: req.params.tenantId, name, description }
        });
        res.status(201).json(newRole);
    } catch (error: any) {
        console.error('Error creating tenant role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/roles/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    try {
        const updatedRole = await tenantDB?.roles.update({
            where: { tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.id } },
            data: { name, description }
        });
        res.json(updatedRole);
    } catch (error: any) {
        console.error('Error updating tenant role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/roles/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.roles.update({
            where: { tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.id } },
            data: { deleted: new Date() }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting tenant role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/roles/:id/permissions', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const rolePermissions = await tenantDB?.role_permissions.findMany({
            where: { role_id: req.params.id },
            include: { permission: true }
        });
        res.json(rolePermissions);
    } catch (error: any) {
        console.error('Error getting role permissions:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/roles/:id/permissions', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { permissionId } = req.body;
    if (!permissionId) return res.status(400).json({ message: 'Permission ID is required.' });
    try {
        const newRolePermission = await tenantDB?.role_permissions.create({
            data: { role_id: req.params.id, permission_id: permissionId }
        });
        res.status(201).json(newRolePermission);
    } catch (error: any) {
        console.error('Error assigning permission to role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/roles/:id/permissions/:permId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.role_permissions.delete({
            where: {
                role_id_permission_id: {
                    role_id: req.params.id,
                    permission_id: req.params.permId
                }
            }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error removing permission from role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/users/:userId/roles', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ message: 'Role ID is required.' });
    try {
        // This assumes 'roles' in tenant_users is an array of IDs or names.
        // For simplicity, we'll append the roleId.
        const updatedTenantUser = await tenantDB?.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: req.params.tenantId,
                    user_id: req.params.userId
                }
            },
            data: {
                roles: {
                    push: roleId
                }
            }
        });
        res.json(updatedTenantUser);
    } catch (error: any) {
        console.error('Error assigning role to user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/users/:userId/roles/:roleId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        // This operation would be more complex to remove a specific item from an array field.
        // For a more robust solution, 'roles' should be a separate join table (user_roles).
        // Placeholder for array item removal logic:
        const tenantUser = await tenantDB?.tenant_users.findUnique({
            where: {
                tenant_id_user_id: {
                    tenant_id: req.params.tenantId,
                    user_id: req.params.userId
                }
            }
        });
        if (tenantUser) {
            const updatedRoles = tenantUser.roles.filter(r => r !== req.params.roleId);
            const updatedTenantUser = await tenantDB?.tenant_users.update({
                where: {
                    tenant_id_user_id: {
                        tenant_id: req.params.tenantId,
                        user_id: req.params.userId
                    }
                },
                data: { roles: updatedRoles }
            });
            return res.json(updatedTenantUser);
        }
        res.status(404).json({ message: 'User or Role not found.' });
    } catch (error: any) {
        console.error('Error removing role from user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


tenantRouter.get('/:tenantId/workspaces/:workspaceId/roles', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        // Workspace-specific roles are often just tenant roles assigned in a workspace context
        // For simplicity, this lists tenant roles, filtered if they are linked to this workspace
        const workspaceRoles = await tenantDB?.roles.findMany({
            where: {
                tenant_id: req.params.tenantId,
                // You might add a filter here if roles can be specifically "workspace-bound" in your schema
            },
            include: { role_permissions: { include: { permission: true } } }
        });
        res.json(workspaceRoles);
    } catch (error: any) {
        console.error('Error listing workspace roles:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/roles', async (req, res) => {
    // This is typically creating a new tenant role, but associating it with a workspace context implicitly
    // Or creating a specific "workspace role" if your schema supports it distinctly from tenant roles.
    // Assuming it's creating a new tenant role that might be used for this workspace.
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Role name is required.' });
    try {
        const newRole = await tenantDB?.roles.create({
            data: {
                tenant_id: req.params.tenantId,
                name,
                description,
                // Potentially link to workspace directly here if 'roles' had a workspace_id field
            }
        });
        res.status(201).json(newRole);
    } catch (error: any) {
        console.error('Error creating workspace role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/workspaces/:workspaceId/roles/:roleId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    try {
        const updatedRole = await tenantDB?.roles.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.roleId }
            },
            data: { name, description }
        });
        res.json(updatedRole);
    } catch (error: any) {
        console.error('Error updating workspace role:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// --- Invitation Management ---
tenantRouter.get('/:tenantId/invitations', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const invitations = await tenantDB?.invitations.findMany({
            where: { tenant_id: req.params.tenantId }
        });
        res.json(invitations);
    } catch (error: any) {
        console.error('Error listing invitations:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/invitations', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required for invitation.' });
    try {
        const invitationToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days
        const newInvitation = await tenantDB?.invitations.create({
            data: {
                tenant_id: req.params.tenantId,
                email,
                token: invitationToken,
                expires_at: expiresAt,
                invited_by_user_id: req.auth?.user // Assuming req.auth.user holds the sender's ID
            }
        });
        // In a real app, send an email with the invitation link including the token
        res.status(201).json({ message: 'Invitation sent (demo only, no email sent).', invitation: newInvitation });
    } catch (error: any) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Public endpoint for invitation details (does not require tenant context via path)
tenantRouter.get('/invitations/:token', async (req, res) => {
    // This uses the base prisma client as it's a public endpoint not restricted by tenant_id in path
    const prisma = new PrismaClient();
    try {
        const invitation = await prisma.invitations.findUnique({
            where: { token: req.params.token }
        });
        if (!invitation || invitation.status !== 'pending' || (invitation.expires_at && invitation.expires_at < new Date())) {
            return res.status(404).json({ message: 'Invitation not found, expired, or already accepted/cancelled.' });
        }
        res.json({
            tenantId: invitation.tenant_id,
            email: invitation.email,
            status: invitation.status,
            expires_at: invitation.expires_at
        });
    } catch (error: any) {
        console.error('Error getting invitation details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Public endpoint for accepting invitation (does not require tenant context via path)
tenantRouter.post('/invitations/:token/accept', async (req, res) => {
    const prisma = new PrismaClient();
    const { userId } = req.body; // New user's ID or existing user's ID accepting it
    try {
        const invitation = await prisma.invitations.findUnique({
            where: { token: req.params.token }
        });

        if (!invitation || invitation.status !== 'pending' || (invitation.expires_at && invitation.expires_at < new Date())) {
            return res.status(400).json({ message: 'Invitation invalid, expired, or already accepted/cancelled.' });
        }

        // 1. Mark invitation as accepted
        await prisma.invitations.update({
            where: { id: invitation.id },
            data: { status: 'accepted' }
        });

        // 2. Ensure user exists (create if new, or link existing)
        let actualUserId = userId;
        if (!actualUserId) { // If no userId provided, attempt to create from invitation email
             const existingUser = await prisma.users.findUnique({ where: { email: invitation.email } });
             if (existingUser) {
                actualUserId = existingUser.id;
             } else {
                const newUser = await prisma.users.create({
                    data: { email: invitation.email, name: invitation.email?.split('@')[0] }
                });
                actualUserId = newUser.id;
             }
        } else {
            // Verify if the provided userId exists
            const userExists = await prisma.users.findUnique({ where: { id: actualUserId } });
            if (!userExists) {
                return res.status(400).json({ message: 'Provided user ID does not exist.' });
            }
        }

        // 3. Associate user with the tenant
        await prisma.tenant_users.create({
            data: {
                tenant_id: invitation.tenant_id,
                user_id: actualUserId,
                email: invitation.email,
                roles: ['member'] // Default role, could be specified in invitation
            }
        });

        res.status(200).json({ message: 'Invitation accepted successfully. User added to organization.', userId: actualUserId, tenantId: invitation.tenant_id });
    } catch (error: any) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});

tenantRouter.delete('/:tenantId/invitations/:id', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.invitations.update({
            where: { tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.id } },
            data: { status: 'cancelled' }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error cancelling invitation:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/invitations/:id/resend', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const invitation = await tenantDB?.invitations.findUnique({
            where: { tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.id } }
        });
        if (!invitation) return res.status(404).json({ message: 'Invitation not found.' });

        // Generate new token and extend expiry
        const newToken = uuidv4();
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        const updatedInvitation = await tenantDB?.invitations.update({
            where: { id: req.params.id },
            data: { token: newToken, expires_at: newExpiresAt, status: 'pending' }
        });
        // In a real app, send new email
        res.status(200).json({ message: 'Invitation resent (demo only, no email sent).', invitation: updatedInvitation });
    } catch (error: any) {
        console.error('Error resending invitation:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Organization Settings (Tenant-specific) ---
tenantRouter.get('/:tenantId/organization', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        // Nile's RLS means this will fetch only the current tenant's organization details.
        const organization = await tenantDB?.organizations.findUnique({
            where: { id: req.params.tenantId }
        });
        if (!organization) return res.status(404).json({ message: 'Organization not found.' });
        res.json(organization);
    } catch (error: any) {
        console.error('Error getting organization details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/organization', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name } = req.body;
    try {
        const updatedOrg = await tenantDB?.organizations.update({
            where: { id: req.params.tenantId },
            data: { name }
        });
        res.json(updatedOrg);
    } catch (error: any) {
        console.error('Error updating organization settings:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/organization/plan', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const organization = await tenantDB?.organizations.findUnique({
            where: { id: req.params.tenantId },
            include: {
                plans: true // Assuming a direct relation for current_plan_id
            }
        });
        if (!organization) return res.status(404).json({ message: 'Organization not found.' });
        // You'd typically load the plan details via organization.current_plan_id
        const currentPlan = organization.current_plan_id ?
            await tenantDB?.plans.findUnique({ where: { id: organization.current_plan_id } }) : null;
        res.json(currentPlan || { message: 'No plan assigned.' });
    } catch (error: any) {
        console.error('Error getting organization plan:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/organization/usage', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        // Placeholder for real API usage stats logic for the tenant
        const totalConversations = await tenantDB?.conversations.count({ where: { tenant_id: req.params.tenantId } });
        const totalMessages = await tenantDB?.messages.count({ where: { tenant_id: req.params.tenantId } });
        res.json({
            totalConversations,
            totalMessages,
            note: 'This is a placeholder for detailed tenant-specific API usage statistics.'
        });
    } catch (error: any) {
        console.error('Error getting organization usage stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// --- AI Customer Service System Specific Endpoints ---

// Customer Interactions (using 'todos' as per example)
tenantRouter.post('/:tenantId/customer-interactions', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    if (!tenantDB) {
      throw new Error("No tenant DB found");
    }

    const { title, complete } = req.body;
    const tenantId = req.params.tenantId;

    try {
      const similarInteractions = await findSimilarCustomerInteractions(tenantDB, title);
      console.log("found similar interactions: " + JSON.stringify(similarInteractions));

      const estimate = await aiEstimate(title, similarInteractions);
      console.log("estimated time for interaction: " + estimate);

      const embedding = await embedTask(title, EmbeddingTasks.SEARCH_DOCUMENT);

      // This is safe because Nile validates the tenant ID and protects against SQL injection
      // The 'todos' table is used here to match the example's AI functions
      const newInteraction = await tenantDB.$queryRawUnsafe(
        `INSERT INTO todos (tenant_id, title, complete, estimate, embedding) VALUES ('${tenantId}', $1, $2, $3, $4::vector)
        RETURNING id, title, complete, estimate`,
        title,
        complete || false, // default to false if not provided
        estimate,
        embeddingToSQL(embedding)
      );

      res.status(201).json(newInteraction);
    } catch (error: any) {
      console.error("error adding customer interaction:", error.message);
      res.status(500).json({
        message: "Internal Server Error: " + error.message,
      });
    }
});

tenantRouter.get('/:tenantId/customer-interactions', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        // Nile's RLS ensures only this tenant's interactions are returned
        const interactions = await tenantDB?.todos.findMany(); // Using 'todos' table for interactions
        res.json(interactions);
    } catch (error: any) {
        console.error('Error listing customer interactions:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- AI Agents/Bots Management (Within a Workspace) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/agents', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const agents = await tenantDB?.ai_agents.findMany({
            where: { tenant_id: req.params.tenantId, workspace_id: req.params.workspaceId }
        });
        res.json(agents);
    } catch (error: any) {
        console.error('Error listing AI agents:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/agents', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description, model_config } = req.body;
    if (!name) return res.status(400).json({ message: 'Agent name is required.' });
    try {
        const newAgent = await tenantDB?.ai_agents.create({
            data: { tenant_id: req.params.tenantId, workspace_id: req.params.workspaceId, name, description, model_config }
        });
        res.status(201).json(newAgent);
    } catch (error: any) {
        console.error('Error creating AI agent:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/workspaces/:workspaceId/agents/:agentId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const agent = await tenantDB?.ai_agents.findUnique({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.agentId },
                workspace_id: req.params.workspaceId // Ensure it belongs to the specified workspace
            }
        });
        if (!agent) return res.status(404).json({ message: 'AI Agent not found.' });
        res.json(agent);
    } catch (error: any) {
        console.error('Error getting AI agent details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/workspaces/:workspaceId/agents/:agentId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description, model_config, status } = req.body;
    try {
        const updatedAgent = await tenantDB?.ai_agents.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.agentId },
                workspace_id: req.params.workspaceId
            },
            data: { name, description, model_config, status }
        });
        res.json(updatedAgent);
    } catch (error: any) {
        console.error('Error updating AI agent:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/agents/:agentId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.ai_agents.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.agentId },
                workspace_id: req.params.workspaceId
            },
            data: { deleted: new Date() }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting AI agent:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/agents/:agentId/activate', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { activate } = req.body;
    try {
        await tenantDB?.ai_agents.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.agentId },
                workspace_id: req.params.workspaceId
            },
            data: { status: activate ? 'active' : 'inactive', deleted: activate ? null : new Date() }
        });
        res.status(200).json({ message: `AI Agent ${activate ? 'activated' : 'deactivated'}.` });
    } catch (error: any) {
        console.error('Error activating/deactivating AI agent:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Knowledge Base & Training Data (Within a Workspace for Agents) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const kbs = await tenantDB?.knowledge_bases.findMany({
            where: { tenant_id: req.params.tenantId, workspace_id: req.params.workspaceId }
        });
        res.json(kbs);
    } catch (error: any) {
        console.error('Error listing knowledge bases:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/knowledge-bases', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Knowledge base name is required.' });
    try {
        const newKb = await tenantDB?.knowledge_bases.create({
            data: { tenant_id: req.params.tenantId, workspace_id: req.params.workspaceId, name, description }
        });
        res.status(201).json(newKb);
    } catch (error: any) {
        console.error('Error creating knowledge base:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const kb = await tenantDB?.knowledge_bases.findUnique({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.kbId },
                workspace_id: req.params.workspaceId
            }
        });
        if (!kb) return res.status(404).json({ message: 'Knowledge base not found.' });
        res.json(kb);
    } catch (error: any) {
        console.error('Error getting knowledge base details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { name, description } = req.body;
    try {
        const updatedKb = await tenantDB?.knowledge_bases.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.kbId },
                workspace_id: req.params.workspaceId
            },
            data: { name, description }
        });
        res.json(updatedKb);
    } catch (error: any) {
        console.error('Error updating knowledge base:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.knowledge_bases.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.kbId },
                workspace_id: req.params.workspaceId
            },
            data: { deleted: new Date() }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting knowledge base:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Document title and content are required.' });
    try {
        const embedding = await embedTask(content, EmbeddingTasks.SEARCH_DOCUMENT); // Embed document content
        const newDoc = await tenantDB?.documents.create({
            data: {
                knowledge_base_id: req.params.kbId,
                tenant_id: req.params.tenantId,
                workspace_id: req.params.workspaceId,
                title,
                content,
                embedding: embeddingToSQL(embedding) // Store as string for Unsupported type
            }
        });
        res.status(201).json(newDoc);
    } catch (error: any) {
        console.error('Error uploading document:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const documents = await tenantDB?.documents.findMany({
            where: {
                tenant_id: req.params.tenantId,
                workspace_id: req.params.workspaceId,
                knowledge_base_id: req.params.kbId
            }
        });
        res.json(documents);
    } catch (error: any) {
        console.error('Error listing documents:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents/:docId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const document = await tenantDB?.documents.findUnique({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.docId },
                workspace_id: req.params.workspaceId,
                knowledge_base_id: req.params.kbId
            }
        });
        if (!document) return res.status(404).json({ message: 'Document not found.' });
        res.json(document);
    } catch (error: any) {
        console.error('Error getting document details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents/:docId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { title, content } = req.body;
    try {
        const updateData: any = { title, content };
        if (content) {
            updateData.embedding = embeddingToSQL(await embedTask(content, EmbeddingTasks.SEARCH_DOCUMENT));
        }
        const updatedDoc = await tenantDB?.documents.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.docId },
                workspace_id: req.params.workspaceId,
                knowledge_base_id: req.params.kbId
            },
            data: updateData
        });
        res.json(updatedDoc);
    } catch (error: any) {
        console.error('Error updating document:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.delete('/:tenantId/workspaces/:workspaceId/knowledge-bases/:kbId/documents/:docId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        await tenantDB?.documents.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.docId },
                workspace_id: req.params.workspaceId,
                knowledge_base_id: req.params.kbId
            },
            data: { deleted: new Date() }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting document:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/agents/:agentId/train', async (req, res) => {
    // This would trigger a background job to train/retrain the AI agent
    // based on linked knowledge bases and new data.
    // This is a complex operation and will be a placeholder.
    res.status(202).json({ message: 'AI Agent training initiated (placeholder).' });
});

// --- Conversation & Interaction History (Within a Workspace) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const conversations = await tenantDB?.conversations.findMany({
            where: { tenant_id: req.params.tenantId, workspace_id: req.params.workspaceId },
            orderBy: { start_time: 'desc' }
        });
        res.json(conversations);
    } catch (error: any) {
        console.error('Error listing conversations:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/conversations', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { customer_id, initial_message_content, agent_id } = req.body;
    if (!customer_id || !initial_message_content) return res.status(400).json({ message: 'Customer ID and initial message content are required.' });
    try {
        const newConversation = await tenantDB?.conversations.create({
            data: {
                tenant_id: req.params.tenantId,
                workspace_id: req.params.workspaceId,
                customer_id,
                agent_id,
                messages: {
                    create: {
                        tenant_id: req.params.tenantId,
                        workspace_id: req.params.workspaceId,
                        sender_type: 'CUSTOMER',
                        content: initial_message_content,
                        embedding: embeddingToSQL(await embedTask(initial_message_content, EmbeddingTasks.SEARCH_DOCUMENT))
                    }
                }
            }
        });
        res.status(201).json(newConversation);
    } catch (error: any) {
        console.error('Error starting new conversation:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});


tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations/:conversationId', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const conversation = await tenantDB?.conversations.findUnique({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.conversationId },
                workspace_id: req.params.workspaceId
            }
        });
        if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
        res.json(conversation);
    } catch (error: any) {
        console.error('Error getting conversation details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/workspaces/:workspaceId/conversations/:conversationId/messages', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const messages = await tenantDB?.messages.findMany({
            where: {
                tenant_id: req.params.tenantId,
                workspace_id: req.params.workspaceId,
                conversation_id: req.params.conversationId
            },
            orderBy: { timestamp: 'asc' }
        });
        res.json(messages);
    } catch (error: any) {
        console.error('Error listing conversation messages:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.post('/:tenantId/workspaces/:workspaceId/conversations/:conversationId/messages', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { sender_type, content } = req.body; // sender_type: 'CUSTOMER', 'AGENT', 'HUMAN_AGENT'
    if (!sender_type || !content) return res.status(400).json({ message: 'Sender type and content are required.' });
    try {
        const embedding = await embedTask(content, EmbeddingTasks.SEARCH_DOCUMENT);
        const newMessage = await tenantDB?.messages.create({
            data: {
                conversation_id: req.params.conversationId,
                tenant_id: req.params.tenantId,
                workspace_id: req.params.workspaceId,
                sender_type,
                content,
                embedding: embeddingToSQL(embedding)
            }
        });
        res.status(201).json(newMessage);
    } catch (error: any) {
        console.error('Error adding message to conversation:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});

// --- AI Model Configuration (Workspace Level) ---
tenantRouter.get('/:tenantId/workspaces/:workspaceId/ai-settings', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const aiSettings = await tenantDB?.ai_settings.findUnique({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.workspaceId } // Assuming workspaceId is also the ai_settings ID for 1:1 relation
            }
        });
        if (!aiSettings) {
            // Create default settings if none exist
            const newSettings = await tenantDB?.ai_settings.create({
                data: {
                    tenant_id: req.params.tenantId,
                    workspace_id: req.params.workspaceId,
                    default_ai_model: process.env.AI_MODEL || "default-model",
                    embedding_model: process.env.EMBEDDING_MODEL || "default-embedding-model",
                    temperature: 0.7,
                    max_tokens: 500
                }
            });
            return res.json(newSettings);
        }
        res.json(aiSettings);
    } catch (error: any) {
        console.error('Error getting AI settings:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.put('/:tenantId/workspaces/:workspaceId/ai-settings', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    const { default_ai_model, embedding_model, temperature, max_tokens } = req.body;
    try {
        const updatedSettings = await tenantDB?.ai_settings.update({
            where: {
                tenant_id_id: { tenant_id: req.params.tenantId, id: req.params.workspaceId }
            },
            data: { default_ai_model, embedding_model, temperature, max_tokens }
        });
        res.json(updatedSettings);
    } catch (error: any) {
        console.error('Error updating AI settings:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Reporting & Analytics (Tenant-Specific for AI Metrics) ---
tenantRouter.get('/:tenantId/analytics/agent-performance', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const agentPerformance = await tenantDB?.ai_agents.findMany({
            where: { tenant_id: req.params.tenantId },
            select: {
                id: true,
                name: true,
                status: true,
                _count: {
                    select: { conversations: true }
                }
            }
        });
        res.json({
            agentPerformance,
            note: 'Placeholder for detailed AI agent performance metrics.'
        });
    } catch (error: any) {
        console.error('Error fetching agent performance:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/analytics/conversation-metrics', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const totalConversations = await tenantDB?.conversations.count({ where: { tenant_id: req.params.tenantId } });
        const resolvedConversations = await tenantDB?.conversations.count({ where: { tenant_id: req.params.tenantId, status: 'RESOLVED' } });
        const sentimentBreakdown = await tenantDB?.conversations.groupBy({
            by: ['sentiment'],
            where: { tenant_id: req.params.tenantId },
            _count: { id: true },
        });

        res.json({
            totalConversations,
            resolvedConversations,
            sentimentBreakdown,
            note: 'Placeholder for detailed conversation metrics (resolution rates, sentiment).'
        });
    } catch (error: any) {
        console.error('Error fetching conversation metrics:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

tenantRouter.get('/:tenantId/audit-logs', async (req, res) => {
    const tenantDB = tenantContext.getStore();
    try {
        const tenantAuditLogs = await tenantDB?.audit_logs.findMany({
            where: { tenant_id: req.params.tenantId, log_type: 'ORGANIZATION' },
            orderBy: { timestamp: 'desc' },
            take: 100 // Limit for performance
        });
        res.json(tenantAuditLogs);
    } catch (error: any) {
        console.error('Error fetching tenant audit logs:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

export default tenantRouter;
