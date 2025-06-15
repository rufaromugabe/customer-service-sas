import { Request, Response } from 'express';
import { UserService, WorkspaceService, RoleService, InvitationService } from '../services/index.js';
import { tenantContext } from '../storage.js';
import { PrismaClient } from '@prisma/client';

export class UserController {
    getAllUsers = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const userService = new UserService(tenantDB);
            const users = await userService.getAllUsers();
            res.json(users);
        } catch (error: any) {
            console.error('Error listing users:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getUserById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const userService = new UserService(tenantDB);
            const user = await userService.getUserById(req.params.id);
            
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }
            
            res.json(user);
        } catch (error: any) {
            console.error('Error getting user:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateUserProfile = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            // Get user ID from auth context (in a real app)
            const userId = req.params.id; // For now, use param
            const { name, family_name, given_name, picture } = req.body;

            const userService = new UserService(tenantDB);
            const updatedUser = await userService.updateUser(userId, {
                name,
                family_name,
                given_name,
                picture
            });

            res.json(updatedUser);
        } catch (error: any) {
            console.error('Error updating user profile:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Tenant User Management
    getTenantUsers = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const userService = new UserService(tenantDB);
            const tenantUsers = await userService.getTenantUsers(req.params.tenantId);
            res.json(tenantUsers);
        } catch (error: any) {
            console.error('Error listing tenant users:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    addUserToTenant = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { email, userId, roles } = req.body;
            const userService = new UserService(tenantDB);

            let user_id_to_associate = userId;

            // If no userId provided, create a new user with email
            if (!userId && email) {
                const newUser = await userService.createUser({ email });
                user_id_to_associate = newUser.id;
            }

            if (!user_id_to_associate) {
                return res.status(400).json({ message: 'User ID or email is required.' });
            }

            const newTenantUser = await userService.addUserToTenant(
                req.params.tenantId,
                user_id_to_associate,
                email,
                roles
            );

            res.status(201).json(newTenantUser);
        } catch (error: any) {
            console.error('Error adding user to tenant:', error);
            res.status(500).json({ message: 'Internal Server Error: ' + error.message });
        }
    };

    getTenantUserById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const tenantUser = await tenantDB.tenant_users.findUnique({
                where: {
                    tenant_id_user_id: {
                        tenant_id: req.params.tenantId,
                        user_id: req.params.id
                    }
                }
            });

            if (!tenantUser) {
                return res.status(404).json({ message: 'Tenant user not found.' });
            }

            res.json(tenantUser);
        } catch (error: any) {
            console.error('Error getting tenant user details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateTenantUser = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { roles } = req.body;
            const userService = new UserService(tenantDB);

            const updatedTenantUser = await userService.updateTenantUser(
                req.params.tenantId,
                req.params.id,
                { roles }
            );

            res.json(updatedTenantUser);
        } catch (error: any) {
            console.error('Error updating tenant user:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    removeUserFromTenant = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const userService = new UserService(tenantDB);
            await userService.removeUserFromTenant(req.params.tenantId, req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error removing user from tenant:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    activateUserInTenant = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { activate } = req.body;
            const userService = new UserService(tenantDB);

            if (activate) {
                await userService.activateUserInTenant(req.params.tenantId, req.params.id);
            } else {
                await userService.removeUserFromTenant(req.params.tenantId, req.params.id);
            }

            res.status(200).json({ 
                message: `User ${activate ? 'activated' : 'deactivated'} in tenant.` 
            });
        } catch (error: any) {
            console.error('Error activating/deactivating user in tenant:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Authentication Methods
    googleAuth = async (req: Request, res: Response) => {
        // This endpoint would initiate or complete a Google OAuth flow
        // and create/authenticate a user in the 'users' schema.
        res.status(501).json({ message: 'Google OAuth login not fully implemented in this demo.' });
    };

    logout = async (req: Request, res: Response) => {
        // Invalidate session/JWT for the user
        res.json({ message: 'User logged out successfully.' });
    };

    getCurrentUser = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const userId = (req as any).auth?.user;
            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized.' });
            }

            const user = await tenantDB.users.findUnique({
                where: { id: userId },
                select: { 
                    id: true, 
                    email: true, 
                    name: true, 
                    given_name: true, 
                    family_name: true, 
                    picture: true, 
                    created: true 
                }
            });

            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            res.json(user);
        } catch (error: any) {
            console.error('Error fetching current user info:', error);
            res.status(401).json({ message: 'Unauthorized or user not found.' });
        }
    };

    updateProfile = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const userId = (req as any).auth?.user;
            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized.' });
            }

            const { name, family_name, given_name, picture } = req.body;

            const updatedUser = await tenantDB.users.update({
                where: { id: userId },
                data: { name, family_name, given_name, picture }
            });

            const { deleted, ...userInfo } = updatedUser;
            res.json(userInfo);
        } catch (error: any) {
            console.error('Error updating user profile:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Role Assignment Methods
    assignRoleToUser = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { roleId } = req.body;
            const tenantId = req.params.tenantId;
            const userId = req.params.userId;

            const updatedTenantUser = await tenantDB.tenant_users.update({
                where: {
                    tenant_id_user_id: {
                        tenant_id: tenantId,
                        user_id: userId
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
    };

    removeRoleFromUser = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const tenantId = req.params.tenantId;
            const userId = req.params.userId;
            const roleId = req.params.roleId;

            const tenantUser = await tenantDB.tenant_users.findUnique({
                where: {
                    tenant_id_user_id: {
                        tenant_id: tenantId,
                        user_id: userId
                    }
                }
            });

            if (!tenantUser) {
                return res.status(404).json({ message: 'User not found in tenant.' });
            }

            const updatedRoles = tenantUser.roles.filter(r => r !== roleId);
            const updatedTenantUser = await tenantDB.tenant_users.update({
                where: {
                    tenant_id_user_id: {
                        tenant_id: tenantId,
                        user_id: userId
                    }
                },
                data: { roles: updatedRoles }
            });

            res.json(updatedTenantUser);
        } catch (error: any) {
            console.error('Error removing role from user:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Fix method names for tenant methods
    getTenantUser = async (req: Request, res: Response) => {
        return this.getTenantUserById(req, res);
    };

    activateDeactivateUser = async (req: Request, res: Response) => {
        return this.activateUserInTenant(req, res);
    };

    // ...existing methods...
}
