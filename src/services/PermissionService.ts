import { PrismaClient } from '@prisma/client';

export class PermissionService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getAllPermissions() {
        return await this.prisma.permissions.findMany({
            where: { deleted: null }
        });
    }

    async getPermissionsByType(type: string) {
        return await this.prisma.permissions.findMany({
            where: { type, deleted: null }
        });
    }

    async getPermissionById(id: string) {
        return await this.prisma.permissions.findUnique({
            where: { id }
        });
    }

    async createPermission(data: { name: string, description?: string, type: string }) {
        return await this.prisma.permissions.create({
            data
        });
    }

    async updatePermission(id: string, data: { name?: string, description?: string, type?: string }) {
        return await this.prisma.permissions.update({
            where: { id },
            data
        });
    }

    async deletePermission(id: string) {
        return await this.prisma.permissions.update({
            where: { id },
            data: { deleted: new Date() }
        });
    }

    // Helper methods for specific permission types
    async getOrganizationalPermissions() {
        return this.getPermissionsByType('ORGANIZATIONAL');
    }

    async getWorkspacePermissions() {
        return this.getPermissionsByType('WORKSPACE');
    }

    async createOrganizationalPermission(data: { name: string, description?: string }) {
        return this.createPermission({ ...data, type: 'ORGANIZATIONAL' });
    }

    async createWorkspacePermission(data: { name: string, description?: string }) {
        return this.createPermission({ ...data, type: 'WORKSPACE' });
    }
}
