import { Request, Response } from 'express';
import { RoleService, InvitationService } from '../services/index.ts';
import { tenantContext } from '../storage.ts';

export class RoleController {
    getRolesByTenant = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const roleService = new RoleService(tenantDB);
            const roles = await roleService.getRolesByTenant(req.params.tenantId);
            res.json(roles);
        } catch (error: any) {
            console.error('Error listing tenant roles:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createRole = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            if (!name) {
                return res.status(400).json({ message: 'Role name is required.' });
            }

            const roleService = new RoleService(tenantDB);
            const newRole = await roleService.createRole(req.params.tenantId, {
                name,
                description
            });

            res.status(201).json(newRole);
        } catch (error: any) {
            console.error('Error creating tenant role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getRoleById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const roleService = new RoleService(tenantDB);
            const role = await roleService.getRoleById(req.params.tenantId, req.params.id);

            if (!role) {
                return res.status(404).json({ message: 'Role not found.' });
            }

            res.json(role);
        } catch (error: any) {
            console.error('Error getting role details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateRole = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            const roleService = new RoleService(tenantDB);

            const updatedRole = await roleService.updateRole(
                req.params.tenantId,
                req.params.id,
                { name, description }
            );

            res.json(updatedRole);
        } catch (error: any) {
            console.error('Error updating tenant role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteRole = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const roleService = new RoleService(tenantDB);
            await roleService.deleteRole(req.params.tenantId, req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting tenant role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Role Permissions
    getRolePermissions = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const roleService = new RoleService(tenantDB);
            const rolePermissions = await roleService.getRolePermissions(
                req.params.tenantId,
                req.params.id
            );

            res.json(rolePermissions);
        } catch (error: any) {
            console.error('Error getting role permissions:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    addPermissionToRole = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { permissionId } = req.body;
            if (!permissionId) {
                return res.status(400).json({ message: 'Permission ID is required.' });
            }

            const roleService = new RoleService(tenantDB);
            const newRolePermission = await roleService.addPermissionToRole(
                req.params.tenantId,
                req.params.id,
                permissionId
            );

            res.status(201).json(newRolePermission);
        } catch (error: any) {
            console.error('Error assigning permission to role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    removePermissionFromRole = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const roleService = new RoleService(tenantDB);
            await roleService.removePermissionFromRole(
                req.params.tenantId,
                req.params.id,
                req.params.permId
            );

            res.status(204).send();
        } catch (error: any) {
            console.error('Error removing permission from role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // User Role Management
    addRoleToUser = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { roleId } = req.body;
            if (!roleId) {
                return res.status(400).json({ message: 'Role ID is required.' });
            }

            const roleService = new RoleService(tenantDB);
            const updatedTenantUser = await roleService.addRoleToUser(
                req.params.tenantId,
                req.params.userId,
                roleId
            );

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

            const roleService = new RoleService(tenantDB);
            const updatedTenantUser = await roleService.removeRoleFromUser(
                req.params.tenantId,
                req.params.userId,
                req.params.roleId
            );

            res.json(updatedTenantUser);
        } catch (error: any) {
            console.error('Error removing role from user:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Workspace Roles
    getWorkspaceRoles = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const roleService = new RoleService(tenantDB);
            const roles = await roleService.getRolesByTenant(req.params.tenantId);
            res.json(roles);
        } catch (error: any) {
            console.error('Error listing workspace roles:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createWorkspaceRole = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            if (!name) {
                return res.status(400).json({ message: 'Role name is required.' });
            }

            const roleService = new RoleService(tenantDB);
            const newRole = await roleService.createRole(req.params.tenantId, {
                name,
                description
            });

            res.status(201).json(newRole);
        } catch (error: any) {
            console.error('Error creating workspace role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateWorkspaceRole = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            const roleService = new RoleService(tenantDB);

            const updatedRole = await roleService.updateRole(
                req.params.tenantId,
                req.params.roleId,
                { name, description }
            );

            res.json(updatedRole);
        } catch (error: any) {
            console.error('Error updating workspace role:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Method aliases for tenant routes
    getRoles = async (req: Request, res: Response) => {
        return this.getRolesByTenant(req, res);
    };

    assignPermissionToRole = async (req: Request, res: Response) => {
        return this.addPermissionToRole(req, res);
    };
}
