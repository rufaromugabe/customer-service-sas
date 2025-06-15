import { PrismaClient } from '@prisma/client';

export class AuditService {
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
    }

    async createAuditLog(data: {
        tenant_id: string;
        user_id?: string;
        action: string;
        entity_type: string;
        entity_id?: string;
        details?: object;
        log_type: 'USER' | 'SYSTEM' | 'ADMIN';
    }) {
        return await this.tenantDB.audit_logs.create({
            data: {
                tenant_id: data.tenant_id,
                user_id: data.user_id,
                action: data.action,
                entity_type: data.entity_type,
                entity_id: data.entity_id,
                details: data.details,
                log_type: data.log_type
            }
        });
    }

    async getAuditLogsByTenant(tenantId: string, options?: {
        log_type?: string;
        user_id?: string;
        entity_type?: string;
        limit?: number;
        offset?: number;
    }) {
        const where: any = { tenant_id: tenantId };
        
        if (options?.log_type) where.log_type = options.log_type;
        if (options?.user_id) where.user_id = options.user_id;
        if (options?.entity_type) where.entity_type = options.entity_type;

        return await this.tenantDB.audit_logs.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: options?.limit || 100,
            skip: options?.offset || 0
        });
    }

    async getSystemAuditLogs(options?: {
        limit?: number;
        offset?: number;
    }) {
        return await this.tenantDB.audit_logs.findMany({
            where: { log_type: 'SYSTEM' },
            orderBy: { timestamp: 'desc' },
            take: options?.limit || 100,
            skip: options?.offset || 0
        });
    }

    async getUserAuditLogs(tenantId: string, userId: string, options?: {
        limit?: number;
        offset?: number;
    }) {
        return await this.tenantDB.audit_logs.findMany({
            where: { 
                tenant_id: tenantId,
                user_id: userId,
                log_type: 'USER'
            },
            orderBy: { timestamp: 'desc' },
            take: options?.limit || 100,
            skip: options?.offset || 0
        });
    }

    // Helper methods for common audit actions
    async logUserAction(tenantId: string, userId: string, action: string, entityType: string, entityId?: string, details?: object) {
        return this.createAuditLog({
            tenant_id: tenantId,
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            details,
            log_type: 'USER'
        });
    }

    async logSystemAction(tenantId: string, action: string, entityType: string, entityId?: string, details?: object) {
        return this.createAuditLog({
            tenant_id: tenantId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            details,
            log_type: 'SYSTEM'
        });
    }

    async logAdminAction(tenantId: string, userId: string, action: string, entityType: string, entityId?: string, details?: object) {
        return this.createAuditLog({
            tenant_id: tenantId,
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            details,
            log_type: 'ADMIN'
        });
    }
}
