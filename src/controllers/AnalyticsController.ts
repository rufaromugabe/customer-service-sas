import { Request, Response } from 'express';
import { AnalyticsService, AuditService } from '../services/index.js';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from '../storage.js';

export class AnalyticsController {
    private getAnalyticsService() {
        const tenantDB = tenantContext.getStore();
        if (!tenantDB) {
            throw new Error('Tenant context not established');
        }
        return new AnalyticsService(tenantDB, tenantDB);
    }

    private getAuditService() {
        const tenantDB = tenantContext.getStore();
        if (!tenantDB) {
            throw new Error('Tenant context not established');
        }
        return new AuditService(tenantDB);
    }    // System Analytics (Admin)
    getSystemUsage = async (req: Request, res: Response) => {
        try {
            const analyticsService = this.getAnalyticsService();
            const stats = await analyticsService.getSystemUsageStats();
            res.json(stats);
        } catch (error: any) {
            console.error('Error fetching system usage stats:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getOrganizationMetrics = async (req: Request, res: Response) => {
        try {
            const analyticsService = this.getAnalyticsService();
            const metrics = await analyticsService.getOrganizationMetrics();
            res.json(metrics);
        } catch (error: any) {
            console.error('Error fetching organization metrics:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getSystemAuditLogs = async (req: Request, res: Response) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
            const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
            
            const auditService = this.getAuditService();
            const logs = await auditService.getSystemAuditLogs({ limit, offset });
            res.json(logs);
        } catch (error: any) {
            console.error('Error fetching system audit logs:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };    // Tenant Analytics
    getTenantDashboard = async (req: Request, res: Response) => {
        try {
            const analyticsService = this.getAnalyticsService();
            const workspaceId = req.query.workspaceId as string;
            
            const stats = await analyticsService.getTenantDashboardStats(
                req.params.tenantId, 
                workspaceId
            );
            res.json(stats);
        } catch (error: any) {
            console.error('Error fetching tenant dashboard stats:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getAgentPerformance = async (req: Request, res: Response) => {
        try {
            const analyticsService = this.getAnalyticsService();
            const workspaceId = req.query.workspaceId as string;
            
            const metrics = await analyticsService.getAgentPerformanceMetrics(
                req.params.tenantId, 
                workspaceId
            );
            res.json(metrics);
        } catch (error: any) {
            console.error('Error fetching agent performance metrics:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };    getConversationMetrics = async (req: Request, res: Response) => {
        try {
            const analyticsService = this.getAnalyticsService();
            const workspaceId = req.query.workspaceId as string;
            const days = req.query.days ? parseInt(req.query.days as string) : 30;
            
            const trends = await analyticsService.getConversationTrends(
                req.params.tenantId, 
                workspaceId,
                days
            );
            
            const sentiment = await analyticsService.getSentimentAnalysis(
                req.params.tenantId, 
                workspaceId
            );

            const responseTime = await analyticsService.getResponseTimeMetrics(
                req.params.tenantId, 
                workspaceId
            );

            res.json({
                trends,
                sentiment,
                responseTime
            });
        } catch (error: any) {
            console.error('Error fetching conversation metrics:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getTenantAuditLogs = async (req: Request, res: Response) => {
        try {
            const auditService = this.getAuditService();
            const tenantId = req.params.tenantId;
            
            const options = {
                log_type: req.query.log_type as string,
                user_id: req.query.user_id as string,
                entity_type: req.query.entity_type as string,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
                offset: req.query.offset ? parseInt(req.query.offset as string) : 0
            };
            
            const logs = await auditService.getAuditLogsByTenant(tenantId, options);
            res.json(logs);
        } catch (error: any) {
            console.error('Error fetching tenant audit logs:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Audit Logs
    getAuditLogs = async (req: Request, res: Response) => {
        return this.getTenantAuditLogs(req, res);
    };
}
