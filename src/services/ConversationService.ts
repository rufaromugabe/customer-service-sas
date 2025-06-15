import { PrismaClient } from '@prisma/client';

export class ConversationService {
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
    }

    async getConversationsByWorkspace(tenantId: string, workspaceId: string, status?: string) {
        const where: any = { 
            tenant_id: tenantId, 
            workspace_id: workspaceId,
            deleted: null
        };
        
        if (status) {
            where.status = status;
        }

        return await this.tenantDB.conversations.findMany({
            where,
            orderBy: { start_time: 'desc' }
        });
    }

    async getConversationById(tenantId: string, conversationId: string) {
        return await this.tenantDB.conversations.findUnique({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: conversationId
                }
            }
        });
    }

    async createConversation(tenantId: string, workspaceId: string, data: {
        customer_id?: string;
        agent_id?: string;
        initial_message_content?: string;
    }) {
        const conversation = await this.tenantDB.conversations.create({
            data: {
                tenant_id: tenantId,
                workspace_id: workspaceId,
                customer_id: data.customer_id,
                agent_id: data.agent_id
            }
        });

        // Create initial message if provided
        if (data.initial_message_content) {
            await this.createMessage(tenantId, workspaceId, conversation.id, {
                sender_type: 'CUSTOMER',
                content: data.initial_message_content
            });
        }

        return conversation;
    }

    async updateConversation(tenantId: string, conversationId: string, data: {
        status?: string;
        end_time?: Date;
        sentiment?: string;
        summary?: string;
        agent_id?: string;
    }) {
        return await this.tenantDB.conversations.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: conversationId
                }
            },
            data
        });
    }

    async closeConversation(tenantId: string, conversationId: string, summary?: string) {
        return await this.updateConversation(tenantId, conversationId, {
            status: 'CLOSED',
            end_time: new Date(),
            summary
        });
    }

    async deleteConversation(tenantId: string, conversationId: string) {
        return await this.tenantDB.conversations.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: conversationId
                }
            },
            data: { deleted: new Date() }
        });
    }

    // Messages
    async getMessagesByConversation(tenantId: string, conversationId: string) {
        return await this.tenantDB.messages.findMany({
            where: { 
                tenant_id: tenantId, 
                conversation_id: conversationId
            },
            orderBy: { timestamp: 'asc' }
        });
    }

    async createMessage(tenantId: string, workspaceId: string, conversationId: string, data: {
        sender_type: string;
        content: string;
    }) {
        return await this.tenantDB.messages.create({
            data: {
                tenant_id: tenantId,
                workspace_id: workspaceId,
                conversation_id: conversationId,
                sender_type: data.sender_type,
                content: data.content
            }
        });
    }

    async updateMessage(tenantId: string, messageId: string, data: {
        content?: string;
        embedding?: any;
    }) {
        return await this.tenantDB.messages.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: messageId
                }
            },
            data
        });
    }

    // Analytics
    async getConversationMetrics(tenantId: string, workspaceId?: string) {
        const where: any = { tenant_id: tenantId, deleted: null };
        if (workspaceId) where.workspace_id = workspaceId;

        const totalConversations = await this.tenantDB.conversations.count({ where });
        
        const openConversations = await this.tenantDB.conversations.count({
            where: { ...where, status: 'OPEN' }
        });

        const closedConversations = await this.tenantDB.conversations.count({
            where: { ...where, status: 'CLOSED' }
        });

        // const avgResponseTime = await this.tenantDB.conversations.aggregate({
        //     where: { ...where, status: 'CLOSED', end_time: { not: null } },
        //     _avg: {
        //         // This would require a computed field for duration
        //     }
        // });

        return {
            totalConversations,
            openConversations,
            closedConversations,
            // avgResponseTime: avgResponseTime._avg
        };
    }

    async getSentimentAnalysis(tenantId: string, workspaceId?: string) {
        const where: any = { tenant_id: tenantId, deleted: null };
        if (workspaceId) where.workspace_id = workspaceId;

        const sentimentCounts = await this.tenantDB.conversations.groupBy({
            by: ['sentiment'],
            where: { ...where, sentiment: { not: null } },
            _count: { sentiment: true }
        });

        return sentimentCounts;
    }
}
