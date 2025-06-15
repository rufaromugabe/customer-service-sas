import { Request, Response } from 'express';
import { ConversationService } from '../services/index.ts';
import { tenantContext } from '../storage.ts';

export class ConversationController {
    getConversationsByWorkspace = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const status = req.query.status as string;
            const conversationService = new ConversationService(tenantDB);
            const conversations = await conversationService.getConversationsByWorkspace(
                req.params.tenantId,
                req.params.workspaceId,
                status
            );

            res.json(conversations);
        } catch (error: any) {
            console.error('Error listing conversations:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createConversation = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { customer_id, initial_message_content, agent_id } = req.body;
            if (!customer_id || !initial_message_content) {
                return res.status(400).json({ 
                    message: 'Customer ID and initial message content are required.' 
                });
            }

            const conversationService = new ConversationService(tenantDB);
            const newConversation = await conversationService.createConversation(
                req.params.tenantId,
                req.params.workspaceId,
                { customer_id, initial_message_content, agent_id }
            );

            res.status(201).json(newConversation);
        } catch (error: any) {
            console.error('Error creating conversation:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getConversationById = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const conversationService = new ConversationService(tenantDB);
            const conversation = await conversationService.getConversationById(
                req.params.tenantId,
                req.params.conversationId
            );

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found.' });
            }

            res.json(conversation);
        } catch (error: any) {
            console.error('Error getting conversation details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateConversation = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { status, end_time, sentiment, summary, agent_id } = req.body;
            const conversationService = new ConversationService(tenantDB);

            const updatedConversation = await conversationService.updateConversation(
                req.params.tenantId,
                req.params.conversationId,
                { status, end_time, sentiment, summary, agent_id }
            );

            res.json(updatedConversation);
        } catch (error: any) {
            console.error('Error updating conversation:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    closeConversation = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { summary } = req.body;
            const conversationService = new ConversationService(tenantDB);

            const closedConversation = await conversationService.closeConversation(
                req.params.tenantId,
                req.params.conversationId,
                summary
            );

            res.json(closedConversation);
        } catch (error: any) {
            console.error('Error closing conversation:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteConversation = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const conversationService = new ConversationService(tenantDB);
            await conversationService.deleteConversation(
                req.params.tenantId,
                req.params.conversationId
            );

            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting conversation:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Messages
    getMessagesByConversation = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const conversationService = new ConversationService(tenantDB);
            const messages = await conversationService.getMessagesByConversation(
                req.params.tenantId,
                req.params.conversationId
            );

            res.json(messages);
        } catch (error: any) {
            console.error('Error getting conversation messages:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createMessage = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { sender_type, content } = req.body;
            if (!sender_type || !content) {
                return res.status(400).json({ 
                    message: 'Sender type and content are required.' 
                });
            }

            const conversationService = new ConversationService(tenantDB);
            const newMessage = await conversationService.createMessage(
                req.params.tenantId,
                req.params.workspaceId,
                req.params.conversationId,
                { sender_type, content }
            );

            res.status(201).json(newMessage);
        } catch (error: any) {
            console.error('Error creating message:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateMessage = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { content, embedding } = req.body;
            const conversationService = new ConversationService(tenantDB);

            const updatedMessage = await conversationService.updateMessage(
                req.params.tenantId,
                req.params.messageId,
                { content, embedding }
            );

            res.json(updatedMessage);
        } catch (error: any) {
            console.error('Error updating message:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Customer Interactions (using 'todos' as per example)
    createCustomerInteraction = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const { title, complete } = req.body;
            const tenantId = req.params.tenantId;

            const newInteraction = await tenantDB.todos.create({
                data: {
                    tenant_id: tenantId,
                    title,
                    complete: complete || false
                }
            });

            res.status(201).json(newInteraction);
        } catch (error: any) {
            console.error('Error creating customer interaction:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getCustomerInteractions = async (req: Request, res: Response) => {
        try {
            const tenantDB = tenantContext.getStore();
            if (!tenantDB) {
                return res.status(500).json({ message: 'Tenant context not established' });
            }

            const tenantId = req.params.tenantId;
            const interactions = await tenantDB.todos.findMany({
                where: { tenant_id: tenantId }
            });

            res.json(interactions);
        } catch (error: any) {
            console.error('Error listing customer interactions:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Method aliases for route compatibility
    getConversations = this.getConversationsByWorkspace;
    getConversation = this.getConversationById;
    getConversationMessages = this.getMessagesByConversation;
    addMessage = this.createMessage;
}
