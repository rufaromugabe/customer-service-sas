import { PrismaClient } from '@prisma/client';

export class WorkspaceService {
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
    }

    async getWorkspacesByTenant(tenantId: string) {
        return await this.tenantDB.workspaces.findMany({
            where: { tenant_id: tenantId, deleted: null }
        });
    }

    async getWorkspaceById(tenantId: string, workspaceId: string) {
        return await this.tenantDB.workspaces.findUnique({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: workspaceId
                }
            }
        });
    }

    async createWorkspace(tenantId: string, data: { name: string, description?: string }) {
        return await this.tenantDB.workspaces.create({
            data: {
                tenant_id: tenantId,
                name: data.name,
                description: data.description
            }
        });
    }

    async updateWorkspace(tenantId: string, workspaceId: string, data: { name?: string, description?: string }) {
        return await this.tenantDB.workspaces.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: workspaceId
                }
            },
            data
        });
    }

    async deleteWorkspace(tenantId: string, workspaceId: string) {
        return await this.tenantDB.workspaces.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: workspaceId
                }
            },
            data: { deleted: new Date() }
        });
    }

    // Workspace Users
    async getWorkspaceUsers(tenantId: string, workspaceId: string) {
        return await this.tenantDB.workspace_users.findMany({
            where: { 
                tenant_id: tenantId, 
                workspace_id: workspaceId,
                deleted: null
            }
        });
    }

    async addUserToWorkspace(tenantId: string, workspaceId: string, userId: string, roleId: string) {
        return await this.tenantDB.workspace_users.create({
            data: {
                tenant_id: tenantId,
                workspace_id: workspaceId,
                user_id: userId,
                role_id: roleId
            }
        });
    }

    async removeUserFromWorkspace(tenantId: string, workspaceId: string, userId: string) {
        return await this.tenantDB.workspace_users.delete({
            where: {
                tenant_id_workspace_id_user_id: {
                    tenant_id: tenantId,
                    workspace_id: workspaceId,
                    user_id: userId
                }
            }
        });
    }

    async updateWorkspaceUser(tenantId: string, workspaceId: string, userId: string, data: { role_id?: string }) {
        return await this.tenantDB.workspace_users.update({
            where: {
                tenant_id_workspace_id_user_id: {
                    tenant_id: tenantId,
                    workspace_id: workspaceId,
                    user_id: userId
                }
            },
            data
        });
    }
}
