import { PrismaClient } from '@prisma/client';

export class UserService {
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
    }

    async getAllUsers() {
        return await this.tenantDB.users.findMany({
            where: { deleted: null }
        });
    }

    async getUserById(id: string) {
        return await this.tenantDB.users.findUnique({
            where: { id }
        });
    }

    async createUser(data: {
        name?: string;
        family_name?: string;
        given_name?: string;
        email?: string;
        picture?: string;
    }) {
        return await this.tenantDB.users.create({
            data
        });
    }

    async updateUser(id: string, data: {
        name?: string;
        family_name?: string;
        given_name?: string;
        email?: string;
        picture?: string;
    }) {
        return await this.tenantDB.users.update({
            where: { id },
            data
        });
    }

    async softDeleteUser(id: string) {
        return await this.tenantDB.users.update({
            where: { id },
            data: { deleted: new Date() }
        });
    }

    // Tenant User Management
    async getTenantUsers(tenantId: string) {
        return await this.tenantDB.tenant_users.findMany({
            where: { tenant_id: tenantId, deleted: null }
        });
    }

    async addUserToTenant(tenantId: string, userId: string, email?: string, roles?: string[]) {
        return await this.tenantDB.tenant_users.create({
            data: {
                tenant_id: tenantId,
                user_id: userId,
                email,
                roles: roles || []
            }
        });
    }

    async updateTenantUser(tenantId: string, userId: string, data: { roles?: string[], email?: string }) {
        return await this.tenantDB.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: tenantId,
                    user_id: userId
                }
            },
            data
        });
    }

    async removeUserFromTenant(tenantId: string, userId: string) {
        return await this.tenantDB.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: tenantId,
                    user_id: userId
                }
            },
            data: { deleted: new Date() }
        });
    }

    async activateUserInTenant(tenantId: string, userId: string) {
        return await this.tenantDB.tenant_users.update({
            where: {
                tenant_id_user_id: {
                    tenant_id: tenantId,
                    user_id: userId
                }
            },
            data: { deleted: null }
        });
    }
}
