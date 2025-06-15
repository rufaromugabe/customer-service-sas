import { PrismaClient } from '@prisma/client';
import { findSimilarCustomerInteractions, aiEstimate, embedTask, EmbeddingTasks, embeddingToSQL } from '../AiUtils.js';

export class AIService {
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
    }

    // AI Agents
    async getAgentsByWorkspace(tenantId: string, workspaceId: string) {
        return await this.tenantDB.ai_agents.findMany({
            where: { 
                tenant_id: tenantId, 
                workspace_id: workspaceId,
                deleted: null
            }
        });
    }

    async getAgentById(tenantId: string, agentId: string) {
        return await this.tenantDB.ai_agents.findUnique({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: agentId
                }
            }
        });
    }

    async createAgent(tenantId: string, workspaceId: string, data: {
        name: string;
        description?: string;
        model_config?: object;
    }) {
        return await this.tenantDB.ai_agents.create({
            data: {
                tenant_id: tenantId,
                workspace_id: workspaceId,
                name: data.name,
                description: data.description,
                model_config: data.model_config
            }
        });
    }

    async updateAgent(tenantId: string, agentId: string, data: {
        name?: string;
        description?: string;
        model_config?: object;
        status?: string;
    }) {
        return await this.tenantDB.ai_agents.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: agentId
                }
            },
            data
        });
    }

    async deleteAgent(tenantId: string, agentId: string) {
        return await this.tenantDB.ai_agents.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: agentId
                }
            },
            data: { deleted: new Date() }
        });
    }

    async activateAgent(tenantId: string, agentId: string, activate: boolean) {
        return await this.tenantDB.ai_agents.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: agentId
                }
            },
            data: { status: activate ? 'active' : 'inactive' }
        });
    }

    // Knowledge Bases
    async getKnowledgeBasesByWorkspace(tenantId: string, workspaceId: string) {
        return await this.tenantDB.knowledge_bases.findMany({
            where: { 
                tenant_id: tenantId, 
                workspace_id: workspaceId,
                deleted: null
            }
        });
    }

    async createKnowledgeBase(tenantId: string, workspaceId: string, data: {
        name: string;
        description?: string;
    }) {
        return await this.tenantDB.knowledge_bases.create({
            data: {
                tenant_id: tenantId,
                workspace_id: workspaceId,
                name: data.name,
                description: data.description
            }
        });
    }

    async updateKnowledgeBase(tenantId: string, kbId: string, data: {
        name?: string;
        description?: string;
    }) {
        return await this.tenantDB.knowledge_bases.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: kbId
                }
            },
            data
        });
    }

    async deleteKnowledgeBase(tenantId: string, kbId: string) {
        return await this.tenantDB.knowledge_bases.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: kbId
                }
            },
            data: { deleted: new Date() }
        });
    }

    // Documents
    async getDocumentsByKnowledgeBase(tenantId: string, kbId: string) {
        return await this.tenantDB.documents.findMany({
            where: { 
                tenant_id: tenantId, 
                knowledge_base_id: kbId,
                deleted: null
            }
        });
    }

    async createDocument(tenantId: string, workspaceId: string, kbId: string, data: {
        title: string;
        content: string;
    }) {
        return await this.tenantDB.documents.create({
            data: {
                tenant_id: tenantId,
                workspace_id: workspaceId,
                knowledge_base_id: kbId,
                title: data.title,
                content: data.content
            }
        });
    }

    async updateDocument(tenantId: string, docId: string, data: {
        title?: string;
        content?: string;
    }) {
        return await this.tenantDB.documents.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: docId
                }
            },
            data
        });
    }

    async deleteDocument(tenantId: string, docId: string) {
        return await this.tenantDB.documents.update({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: docId
                }
            },
            data: { deleted: new Date() }
        });
    }

    // AI Settings
    async getAISettings(tenantId: string, workspaceId: string) {
        return await this.tenantDB.ai_settings.findFirst({
            where: { 
                tenant_id: tenantId, 
                workspace_id: workspaceId
            }
        });
    }

    async updateAISettings(tenantId: string, workspaceId: string, data: {
        default_ai_model?: string;
        embedding_model?: string;
        temperature?: number;
        max_tokens?: number;
    }) {
        const existing = await this.getAISettings(tenantId, workspaceId);
        
        if (existing) {
            return await this.tenantDB.ai_settings.update({
                where: {
                    tenant_id_id: {
                        tenant_id: tenantId,
                        id: existing.id
                    }
                },
                data
            });
        } else {
            return await this.tenantDB.ai_settings.create({
                data: {
                    tenant_id: tenantId,
                    workspace_id: workspaceId,
                    ...data
                }
            });
        }
    }

    // Customer Interactions
    async createCustomerInteraction(tenantId: string, data: { title: string; complete?: boolean }) {
        try {
            const similarInteractions = await findSimilarCustomerInteractions(this.tenantDB, data.title);
            console.log("found similar interactions: " + JSON.stringify(similarInteractions));

            const estimate = await aiEstimate(data.title, similarInteractions);
            console.log("estimated time for interaction: " + estimate);

            const embedding = await embedTask(data.title, EmbeddingTasks.SEARCH_DOCUMENT);

            // This is safe because Nile validates the tenant ID and protects against SQL injection
            // The 'todos' table is used here to match the example's AI functions
            const newInteraction = await this.tenantDB.$queryRawUnsafe(
                `INSERT INTO todos (tenant_id, title, complete, estimate, embedding) VALUES ('${tenantId}', $1, $2, $3, $4::vector)
                RETURNING id, title, complete, estimate`,
                data.title,
                data.complete || false,
                estimate,
                embeddingToSQL(embedding)
            );

            return newInteraction;
        } catch (error: any) {
            console.error("Error creating customer interaction:", error.message);
            throw error;
        }
    }

    async getCustomerInteractions(tenantId: string) {
        return await this.tenantDB.todos.findMany({
            where: { tenant_id: tenantId }
        });
    }
}
