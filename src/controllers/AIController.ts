import { Request, Response } from 'express';
import { AIService, ConversationService } from '../services/index.ts';
import { tenantContext } from '../storage.ts';

export class AIController {
    // AI Agents
    getAgentsByWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            const agents = await aiService.getAgentsByWorkspace(
                req.params.tenantId,
                req.params.workspaceId
            );

            res.json(agents);
        } catch (error: any) {
            console.error('Error listing agents:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createAgent = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description, model_config } = req.body;
            if (!name) {
                return res.status(400).json({ message: 'Agent name is required.' });
            }

            const aiService = new AIService(tenantDB);
            const newAgent = await aiService.createAgent(
                req.params.tenantId,
                req.params.workspaceId,
                { name, description, model_config }
            );

            res.status(201).json(newAgent);
        } catch (error: any) {
            console.error('Error creating agent:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getAgentById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            const agent = await aiService.getAgentById(req.params.tenantId, req.params.agentId);

            if (!agent) {
                return res.status(404).json({ message: 'Agent not found.' });
            }

            res.json(agent);
        } catch (error: any) {
            console.error('Error getting agent details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateAgent = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description, model_config, status } = req.body;
            const aiService = new AIService(tenantDB);

            const updatedAgent = await aiService.updateAgent(
                req.params.tenantId,
                req.params.agentId,
                { name, description, model_config, status }
            );

            res.json(updatedAgent);
        } catch (error: any) {
            console.error('Error updating agent:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteAgent = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            await aiService.deleteAgent(req.params.tenantId, req.params.agentId);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting agent:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    activateAgent = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { activate } = req.body;
            const aiService = new AIService(tenantDB);

            await aiService.activateAgent(req.params.tenantId, req.params.agentId, activate);
            res.status(200).json({ 
                message: `Agent ${activate ? 'activated' : 'deactivated'}.` 
            });
        } catch (error: any) {
            console.error('Error activating/deactivating agent:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    trainAgent = async (req: Request, res: Response) => {
        // This would trigger a background job to train/retrain the AI agent
        // based on linked knowledge bases and new data.
        // This is a complex operation and will be a placeholder.
        res.status(202).json({ message: 'AI Agent training initiated (placeholder).' });
    };

    // Knowledge Bases
    getKnowledgeBasesByWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            const knowledgeBases = await aiService.getKnowledgeBasesByWorkspace(
                req.params.tenantId,
                req.params.workspaceId
            );

            res.json(knowledgeBases);
        } catch (error: any) {
            console.error('Error listing knowledge bases:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createKnowledgeBase = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            if (!name) {
                return res.status(400).json({ message: 'Knowledge base name is required.' });
            }

            const aiService = new AIService(tenantDB);
            const newKnowledgeBase = await aiService.createKnowledgeBase(
                req.params.tenantId,
                req.params.workspaceId,
                { name, description }
            );

            res.status(201).json(newKnowledgeBase);
        } catch (error: any) {
            console.error('Error creating knowledge base:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getKnowledgeBaseById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const knowledgeBase = await tenantDB.knowledge_bases.findUnique({
                where: {
                    tenant_id_id: {
                        tenant_id: req.params.tenantId,
                        id: req.params.kbId
                    }
                }
            });

            if (!knowledgeBase) {
                return res.status(404).json({ message: 'Knowledge base not found.' });
            }

            res.json(knowledgeBase);
        } catch (error: any) {
            console.error('Error getting knowledge base details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateKnowledgeBase = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { name, description } = req.body;
            const aiService = new AIService(tenantDB);

            const updatedKnowledgeBase = await aiService.updateKnowledgeBase(
                req.params.tenantId,
                req.params.kbId,
                { name, description }
            );

            res.json(updatedKnowledgeBase);
        } catch (error: any) {
            console.error('Error updating knowledge base:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteKnowledgeBase = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            await aiService.deleteKnowledgeBase(req.params.tenantId, req.params.kbId);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting knowledge base:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Documents
    createDocument = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { title, content } = req.body;
            if (!title || !content) {
                return res.status(400).json({ message: 'Title and content are required.' });
            }

            const aiService = new AIService(tenantDB);
            const newDocument = await aiService.createDocument(
                req.params.tenantId,
                req.params.workspaceId,
                req.params.kbId,
                { title, content }
            );

            res.status(201).json(newDocument);
        } catch (error: any) {
            console.error('Error creating document:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getDocumentsByKnowledgeBase = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            const documents = await aiService.getDocumentsByKnowledgeBase(
                req.params.tenantId,
                req.params.kbId
            );

            res.json(documents);
        } catch (error: any) {
            console.error('Error listing documents:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getDocumentById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const document = await tenantDB.documents.findUnique({
                where: {
                    tenant_id_id: {
                        tenant_id: req.params.tenantId,
                        id: req.params.docId
                    }
                }
            });

            if (!document) {
                return res.status(404).json({ message: 'Document not found.' });
            }

            res.json(document);
        } catch (error: any) {
            console.error('Error getting document details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateDocument = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { title, content } = req.body;
            const aiService = new AIService(tenantDB);

            const updatedDocument = await aiService.updateDocument(
                req.params.tenantId,
                req.params.docId,
                { title, content }
            );

            res.json(updatedDocument);
        } catch (error: any) {
            console.error('Error updating document:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteDocument = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            await aiService.deleteDocument(req.params.tenantId, req.params.docId);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting document:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // AI Settings
    getAISettings = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            const settings = await aiService.getAISettings(
                req.params.tenantId,
                req.params.workspaceId
            );

            res.json(settings || {});
        } catch (error: any) {
            console.error('Error getting AI settings:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateAISettings = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { default_ai_model, embedding_model, temperature, max_tokens } = req.body;
            const aiService = new AIService(tenantDB);

            const updatedSettings = await aiService.updateAISettings(
                req.params.tenantId,
                req.params.workspaceId,
                { default_ai_model, embedding_model, temperature, max_tokens }
            );

            res.json(updatedSettings);
        } catch (error: any) {
            console.error('Error updating AI settings:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Customer Interactions
    createCustomerInteraction = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { title, complete } = req.body;
            const tenantId = req.params.tenantId;

            const aiService = new AIService(tenantDB);
            const newInteraction = await aiService.createCustomerInteraction(
                tenantId,
                { title, complete }
            );

            res.status(201).json(newInteraction);
        } catch (error: any) {
            console.error('Error creating customer interaction:', error);
            res.status(500).json({ message: 'Internal Server Error: ' + error.message });
        }
    };

    getCustomerInteractions = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const aiService = new AIService(tenantDB);
            const interactions = await aiService.getCustomerInteractions(req.params.tenantId);
            res.json(interactions);
        } catch (error: any) {
            console.error('Error listing customer interactions:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Method aliases for tenant routes
    getAgents = async (req: Request, res: Response) => {
        return this.getAgentsByWorkspace(req, res);
    };

    getAgent = async (req: Request, res: Response) => {
        return this.getAgentById(req, res);
    };

    activateDeactivateAgent = async (req: Request, res: Response) => {
        return this.activateAgent(req, res);
    };

    getKnowledgeBases = async (req: Request, res: Response) => {
        return this.getKnowledgeBasesByWorkspace(req, res);
    };

    getKnowledgeBase = async (req: Request, res: Response) => {
        return this.getKnowledgeBaseById(req, res);
    };

    uploadDocument = async (req: Request, res: Response) => {
        return this.createDocument(req, res);
    };

    getDocuments = async (req: Request, res: Response) => {
        return this.getDocumentsByKnowledgeBase(req, res);
    };

    getDocument = async (req: Request, res: Response) => {
        return this.getDocumentById(req, res);
    };

    // ...existing methods...
}
