import { Request, Response } from 'express';
import { WorkspaceService } from '../services/index.ts';
import { tenantContext } from '../storage.ts';

export class WorkspaceController {
    getWorkspacesByTenant = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const workspaceService = new WorkspaceService(tenantDB);
            const workspaces = await workspaceService.getWorkspacesByTenant(req.params.tenantId);
            res.json(workspaces);
        } catch (error: any) {
            console.error('Error listing workspaces:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            if (!name) {
                return res.status(400).json({ message: 'Workspace name is required.' });
            }

            const workspaceService = new WorkspaceService(tenantDB);
            const newWorkspace = await workspaceService.createWorkspace(req.params.tenantId, {
                name,
                description
            });

            res.status(201).json(newWorkspace);
        } catch (error: any) {
            console.error('Error creating workspace:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getWorkspaceById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const workspaceService = new WorkspaceService(tenantDB);
            const workspace = await workspaceService.getWorkspaceById(
                req.params.tenantId,
                req.params.id
            );

            if (!workspace) {
                return res.status(404).json({ message: 'Workspace not found.' });
            }

            res.json(workspace);
        } catch (error: any) {
            console.error('Error getting workspace details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            const workspaceService = new WorkspaceService(tenantDB);

            const updatedWorkspace = await workspaceService.updateWorkspace(
                req.params.tenantId,
                req.params.id,
                { name, description }
            );

            res.json(updatedWorkspace);
        } catch (error: any) {
            console.error('Error updating workspace:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const workspaceService = new WorkspaceService(tenantDB);
            await workspaceService.deleteWorkspace(req.params.tenantId, req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting workspace:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Workspace Users
    getWorkspaceUsers = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const workspaceService = new WorkspaceService(tenantDB);
            const workspaceUsers = await workspaceService.getWorkspaceUsers(
                req.params.tenantId,
                req.params.id
            );

            res.json(workspaceUsers);
        } catch (error: any) {
            console.error('Error listing workspace users:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    addUserToWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { userId, roleId } = req.body;
            if (!userId || !roleId) {
                return res.status(400).json({ message: 'User ID and Role ID are required.' });
            }

            const workspaceService = new WorkspaceService(tenantDB);
            const newWorkspaceUser = await workspaceService.addUserToWorkspace(
                req.params.tenantId,
                req.params.id,
                userId,
                roleId
            );

            res.status(201).json(newWorkspaceUser);
        } catch (error: any) {
            console.error('Error adding user to workspace:', error);
            res.status(500).json({ message: 'Internal Server Error: ' + error.message });
        }
    };

    removeUserFromWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const workspaceService = new WorkspaceService(tenantDB);
            await workspaceService.removeUserFromWorkspace(
                req.params.tenantId,
                req.params.id,
                req.params.userId
            );

            res.status(204).send();
        } catch (error: any) {
            console.error('Error removing user from workspace:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateWorkspaceUser = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { roleId } = req.body;
            const workspaceService = new WorkspaceService(tenantDB);

            const updatedWorkspaceUser = await workspaceService.updateWorkspaceUser(
                req.params.tenantId,
                req.params.id,
                req.params.userId,
                { role_id: roleId }
            );

            res.json(updatedWorkspaceUser);
        } catch (error: any) {
            console.error('Error updating workspace user:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Method aliases for tenant routes
    getWorkspaces = async (req: Request, res: Response) => {
        return this.getWorkspacesByTenant(req, res);
    };

    getWorkspace = async (req: Request, res: Response) => {
        return this.getWorkspaceById(req, res);
    };
}
