import { PrismaClient } from '@prisma/client';

export class RoleService {
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
    }

    async getRolesByTenant(tenantId: string) {
        return await this.tenantDB.roles.findMany({
            where: { tenant_id: tenantId, deleted: null },
            include: { role_permissions: true }
        });
    }

    async getRoleById(tenantId: string, roleId: string) {
        return await this.tenantDB.roles.findUnique({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: roleId
                }
            },
            include: { role_permissions: true }
        });
    }

    async createRole(tenantId: string, data: { name: string, description?: string }) {
        return await this.tenantDB.roles.create({
            data: {
                tenant_id: tenantId,
                name: data.name,
                description: data.description
            }
        });
    }

    async updateRole(tenantId: string, roleId: string, data: { name?: string, description?: string }) {
        return await this.tenantDB.roles.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: roleId
                }
            },
            data
        });
    }

    async deleteRole(tenantId: string, roleId: string) {
        return await this.tenantDB.roles.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: roleId
                }
            },
            data: { deleted: new Date() }
        });
    }

    // Role Permissions
    async getRolePermissions(tenantId: string, roleId: string) {
        return await this.tenantDB.role_permissions.findMany({
            where: { tenant_id: tenantId, role_id: roleId }
        });
    }

    async addPermissionToRole(tenantId: string, roleId: string, permissionId: string) {
        return await this.tenantDB.role_permissions.create({
            data: {
                tenant_id: tenantId,
                role_id: roleId,
                permission_id: permissionId
            }
        });
    }

    async removePermissionFromRole(tenantId: string, roleId: string, permissionId: string) {
        return await this.tenantDB.role_permissions.delete({
            where: {
                tenant_id_role_id_permission_id: {
                    tenant_id: tenantId,
                    role_id: roleId,
                    permission_id: permissionId
                }
            }
        });
    }

    // User Role Management
    async addRoleToUser(tenantId: string, userId: string, roleId: string) {
        // Get current user roles
        const tenantUser = await this.tenantDB.tenant_users.findUnique({
            where: {
                tenant_id_user_id: {
                    tenant_id: tenantId,
                    user_id: userId
                }
            }
        });

        if (!tenantUser) {
            throw new Error('User not found in tenant');
        }

        const currentRoles = tenantUser.roles || [];
        if (!currentRoles.includes(roleId)) {
            return await this.tenantDB.tenant_users.update({
                where: {
                    tenant_id_user_id: {
                        tenant_id: tenantId,
                        user_id: userId
                    }
                },
                data: {
                    roles: [...currentRoles, roleId]
                }
            });
        }

        return tenantUser;
    }

    async removeRoleFromUser(tenantId: string, userId: string, roleId: string) {
        const tenantUser = await this.tenantDB.tenant_users.findUnique({
            where: {
                tenant_id_user_id: {
                    tenant_id: tenantId,
                    user_id: userId
                }
            }
        });

        if (!tenantUser) {
            throw new Error('User not found in tenant');
        }

        const currentRoles = tenantUser.roles || [];
        const updatedRoles = currentRoles.filter(role => role !== roleId);
        
        return await this.tenantDB.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: tenantId,
                    user_id: userId
                }
            },
            data: {
                roles: updatedRoles
            }
        });
    }
}
