import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Customer Service SaaS Backend API',
      version: '1.0.0',
      description: 'Multi-tenant AI customer service backend with Prisma and Express',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],    components: {
      securitySchemes: {
        basicAuth: {
          type: 'http',
          scheme: 'basic',
          description: 'Legacy basic authentication (deprecated)'
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token authentication for admin routes'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'admin_access_token',
          description: 'JWT admin authentication via secure cookie'
        },
        nileSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'nile-session',
          description: 'Nile Auth session cookie for user authentication'
        }
      },
      schemas: {
        Tenant: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '019769f2-174f-7584-a3cd-255126e6f9dc',
            },
            name: {
              type: 'string',
              example: 'Acme Corporation',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
            deleted: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            active: {
              type: 'boolean',
              example: true,
            },
            compute_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            current_plan_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
          },
        },
        Admin: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'admin@example.com',
            },
            name: {
              type: 'string',
              example: 'John Doe',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Plan: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'Pro Plan',
            },
            description: {
              type: 'string',
              example: 'Professional plan with advanced features',
            },
            price: {
              type: 'number',
              format: 'float',
              example: 29.99,
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            name: {
              type: 'string',
              example: 'Jane Smith',
            },
            given_name: {
              type: 'string',
              example: 'Jane',
            },
            family_name: {
              type: 'string',
              example: 'Smith',
            },
            picture: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'An error occurred',
            },
          },
        },        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            service: {
              type: 'string',
              example: 'ai-customer-service-saas-backend',
            },
          },
        },
        Workspace: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'Customer Support Workspace',
            },
            description: {
              type: 'string',
              example: 'Main workspace for customer support operations',
            },
            tenant_id: {
              type: 'string',
              format: 'uuid',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Agent: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'Customer Support Bot',
            },
            description: {
              type: 'string',
              example: 'AI agent for handling customer inquiries',
            },
            workspace_id: {
              type: 'string',
              format: 'uuid',
            },
            model_config: {
              type: 'object',
              example: {
                model: 'gpt-4',
                temperature: 0.7,
                max_tokens: 2048
              },
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'TRAINING'],
              example: 'ACTIVE',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            customer_id: {
              type: 'string',
              example: 'customer_123',
            },
            workspace_id: {
              type: 'string',
              format: 'uuid',
            },
            agent_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'RESOLVED', 'ESCALATED'],
              example: 'ACTIVE',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            conversation_id: {
              type: 'string',
              format: 'uuid',
            },
            sender_type: {
              type: 'string',
              enum: ['CUSTOMER', 'AGENT', 'HUMAN_AGENT'],
              example: 'CUSTOMER',
            },
            content: {
              type: 'string',
              example: 'Hello, I need help with my order',
            },
            metadata: {
              type: 'object',
              nullable: true,
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        KnowledgeBase: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'Product Documentation',
            },
            description: {
              type: 'string',
              example: 'Knowledge base containing product information',
            },
            workspace_id: {
              type: 'string',
              format: 'uuid',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
              example: 'How to reset your password',
            },
            content: {
              type: 'string',
              example: 'To reset your password, follow these steps...',
            },
            knowledge_base_id: {
              type: 'string',
              format: 'uuid',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Role: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'Admin',
            },
            description: {
              type: 'string',
              example: 'Administrator role with full access',
            },
            tenant_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            workspace_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Feature: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'Advanced Analytics',
            },
            description: {
              type: 'string',
              example: 'Access to advanced analytics and reporting',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            updated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Invitation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            tenant_id: {
              type: 'string',
              format: 'uuid',
            },
            invited_by: {
              type: 'string',
              format: 'uuid',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACCEPTED', 'EXPIRED'],
              example: 'PENDING',
            },
            token: {
              type: 'string',
              format: 'uuid',
            },
            created: {
              type: 'string',
              format: 'date-time',
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },    },    tags: [
      {
        name: 'Health',
        description: 'Health check and system status endpoints',
      },
      {
        name: 'Authentication',
        description: 'Nile Auth authentication endpoints (sign in, sign up, profile)',
      },
      {
        name: 'Admin Authentication',
        description: 'Admin authentication endpoints',
      },
      {
        name: 'Admin Management',
        description: 'Admin user management endpoints',
      },
      {
        name: 'Tenant Management',
        description: 'Tenant/Organization management endpoints',
      },
      {
        name: 'Plan Management',
        description: 'Subscription plan management endpoints',
      },
      {
        name: 'User Authentication',
        description: 'Tenant user authentication endpoints',
      },
      {
        name: 'User Management',
        description: 'User management within tenants',
      },
      {
        name: 'Workspace Management',
        description: 'Workspace management within tenants',
      },
      {
        name: 'Role Management',
        description: 'Role and permission management',
      },
      {
        name: 'AI Agents',
        description: 'AI agent management and configuration',
      },
      {
        name: 'Knowledge Base',
        description: 'Knowledge base and document management',
      },
      {
        name: 'Conversations',
        description: 'Customer conversation management',
      },
      {
        name: 'Invitations',
        description: 'User invitation management',
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting endpoints',
      },
      {
        name: 'Customer Service',
        description: 'Customer service and support endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

export { swaggerUi, specs };
