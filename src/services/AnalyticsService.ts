import { PrismaClient } from '@prisma/client';

export class AnalyticsService {
    private tenantDB: PrismaClient;
    private prisma: PrismaClient; // For system-wide analytics

    constructor(tenantDB: PrismaClient, systemPrisma?: PrismaClient) {
        this.tenantDB = tenantDB;
        this.prisma = systemPrisma || new PrismaClient();
    }

    // System-wide Analytics (Admin)
    async getSystemUsageStats() {
        const totalOrganizations = await this.prisma.tenants.count({
            where: { deleted: null }
        });

        const activeOrganizations = await this.prisma.tenants.count({
            where: { active: true, deleted: null }
        });

        const totalUsers = await this.prisma.users.count({
            where: { deleted: null }
        });

        const totalActiveAgents = await this.prisma.ai_agents.count({
            where: { status: 'active', deleted: null }
        });

        const totalConversations = await this.prisma.conversations.count({
            where: { deleted: null }
        });

        const totalDocuments = await this.prisma.documents.count({
            where: { deleted: null }
        });

        return {
            totalOrganizations,
            activeOrganizations,
            totalUsers,
            totalActiveAgents,
            totalConversations,
            totalDocuments
        };
    }

    async getOrganizationMetrics() {
        // Get organizations with their metrics
        const organizations = await this.prisma.tenants.findMany({
            where: { deleted: null },
            select: {
                id: true,
                name: true,
                created: true,
                active: true,
                current_plan_id: true
            }
        });

        const metrics = await Promise.all(
            organizations.map(async (org) => {
                const userCount = await this.prisma.tenant_users.count({
                    where: { tenant_id: org.id, deleted: null }
                });

                const workspaceCount = await this.prisma.workspaces.count({
                    where: { tenant_id: org.id, deleted: null }
                });

                const agentCount = await this.prisma.ai_agents.count({
                    where: { tenant_id: org.id, deleted: null }
                });

                const conversationCount = await this.prisma.conversations.count({
                    where: { tenant_id: org.id, deleted: null }
                });

                return {
                    ...org,
                    userCount,
                    workspaceCount,
                    agentCount,
                    conversationCount
                };
            })
        );

        return metrics;
    }

    // Tenant-specific Analytics
    async getTenantDashboardStats(tenantId: string, workspaceId?: string) {
        const where: any = { tenant_id: tenantId, deleted: null };
        if (workspaceId) where.workspace_id = workspaceId;

        const totalConversations = await this.tenantDB.conversations.count({ where });
        
        const openConversations = await this.tenantDB.conversations.count({
            where: { ...where, status: 'OPEN' }
        });

        const closedConversations = await this.tenantDB.conversations.count({
            where: { ...where, status: 'CLOSED' }
        });

        const totalAgents = await this.tenantDB.ai_agents.count({
            where: workspaceId ? 
                { tenant_id: tenantId, workspace_id: workspaceId, deleted: null } :
                { tenant_id: tenantId, deleted: null }
        });

        const activeAgents = await this.tenantDB.ai_agents.count({
            where: workspaceId ? 
                { tenant_id: tenantId, workspace_id: workspaceId, status: 'active', deleted: null } :
                { tenant_id: tenantId, status: 'active', deleted: null }
        });

        const totalDocuments = await this.tenantDB.documents.count({
            where: workspaceId ? 
                { tenant_id: tenantId, workspace_id: workspaceId, deleted: null } :
                { tenant_id: tenantId, deleted: null }
        });

        const totalKnowledgeBases = await this.tenantDB.knowledge_bases.count({
            where: workspaceId ? 
                { tenant_id: tenantId, workspace_id: workspaceId, deleted: null } :
                { tenant_id: tenantId, deleted: null }
        });

        return {
            totalConversations,
            openConversations,
            closedConversations,
            totalAgents,
            activeAgents,
            totalDocuments,
            totalKnowledgeBases
        };
    }

    async getAgentPerformanceMetrics(tenantId: string, workspaceId?: string) {
        const where: any = { tenant_id: tenantId, deleted: null };
        if (workspaceId) where.workspace_id = workspaceId;

        // Get agents with their conversation counts
        const agents = await this.tenantDB.ai_agents.findMany({
            where: workspaceId ? 
                { tenant_id: tenantId, workspace_id: workspaceId, deleted: null } :
                { tenant_id: tenantId, deleted: null },
            select: {
                id: true,
                name: true,
                status: true,
                created: true
            }
        });

        const agentMetrics = await Promise.all(
            agents.map(async (agent) => {
                const totalConversations = await this.tenantDB.conversations.count({
                    where: { ...where, agent_id: agent.id }
                });

                const resolvedConversations = await this.tenantDB.conversations.count({
                    where: { ...where, agent_id: agent.id, status: 'CLOSED' }
                });                // const averageRating = await this.tenantDB.conversations.aggregate({
                //     where: { ...where, agent_id: agent.id, sentiment: { not: null } },
                //     _avg: {
                //         // This would require a rating field in the schema
                //     }
                // });

                return {
                    ...agent,
                    totalConversations,
                    resolvedConversations,
                    resolutionRate: totalConversations > 0 ? 
                        (resolvedConversations / totalConversations) * 100 : 0
                };
            })
        );

        return agentMetrics;
    }

    async getConversationTrends(tenantId: string, workspaceId?: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const where: any = { 
            tenant_id: tenantId, 
            deleted: null,
            start_time: { gte: startDate }
        };
        if (workspaceId) where.workspace_id = workspaceId;

        // Group conversations by day
        const conversations = await this.tenantDB.conversations.findMany({
            where,
            select: {
                start_time: true,
                status: true,
                sentiment: true
            }
        });

        // Process data to create daily trends
        const dailyData: { [key: string]: { total: number, open: number, closed: number } } = {};
        
        conversations.forEach(conv => {
            const day = conv.start_time.toISOString().split('T')[0];
            if (!dailyData[day]) {
                dailyData[day] = { total: 0, open: 0, closed: 0 };
            }
            dailyData[day].total++;
            if (conv.status === 'OPEN') dailyData[day].open++;
            if (conv.status === 'CLOSED') dailyData[day].closed++;
        });

        return dailyData;
    }

    async getSentimentAnalysis(tenantId: string, workspaceId?: string) {
        const where: any = { 
            tenant_id: tenantId, 
            deleted: null,
            sentiment: { not: null }
        };
        if (workspaceId) where.workspace_id = workspaceId;

        const sentimentCounts = await this.tenantDB.conversations.groupBy({
            by: ['sentiment'],
            where,
            _count: { sentiment: true }
        });

        return sentimentCounts.reduce((acc, item) => {
            if (item.sentiment) {
                acc[item.sentiment] = item._count.sentiment;
            }
            return acc;
        }, {} as { [key: string]: number });
    }

    async getResponseTimeMetrics(tenantId: string, workspaceId?: string) {
        const where: any = { 
            tenant_id: tenantId, 
            deleted: null,
            status: 'CLOSED',
            end_time: { not: null }
        };
        if (workspaceId) where.workspace_id = workspaceId;

        // This would require calculating response times based on message timestamps
        // For now, return placeholder data
        return {
            averageResponseTime: 0, // in minutes
            medianResponseTime: 0,
            fastestResponse: 0,
            slowestResponse: 0
        };
    }
}
