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
    ],
    components: {
      securitySchemes: {
        basicAuth: {
          type: 'http',
          scheme: 'basic',
        },
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
        },
        HealthCheck: {
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
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check and system status endpoints',
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
        name: 'Customer Service',
        description: 'Customer service and support endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

export { swaggerUi, specs };
