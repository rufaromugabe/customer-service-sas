import express from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import expressBasicAuth from 'express-basic-auth';
import cookieParser from 'cookie-parser';
import { tenantContext } from './storage.ts';
import { dbAuthorizer, getUnauthorizedResponse, REQUIRE_AUTH } from './basicauth.ts';
import dotenv from 'dotenv';
import adminRoutes from './routes/adminRoutes.ts';
import tenantRoutes from './routes/tenantRoutes.ts';
import nileAuthRoutes from './routes/nileAuthRoutes.ts';
import { swaggerUi, specs } from './swagger.ts';
import { 
  securityHeaders, 
  corsMiddleware, 
  generalRateLimit, 
  sanitizeInput, 
  limitRequestSize, 
  trackClientInfo 
} from './middleware/index.ts';

console.log('Starting application...');
dotenv.config();
console.log('Environment configured...');

const PORT = process.env.PORT || 3001;
console.log(`PORT set to: ${PORT}`);

console.log('Creating Prisma client...');
const prisma = new PrismaClient({ log: ["query", "info", "warn", "error"] });
console.log('Prisma client created successfully');

const app = express();
console.log('Express app created');

// Apply security middleware early
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(generalRateLimit);
app.use(trackClientInfo);
app.use(sanitizeInput);
app.use(limitRequestSize);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
console.log('Security middleware and parsers configured...');

/**
 * Creates a Prisma Client Extension which sets Nile tenant context
 *
 * Queries are wrapped in a transaction, because PostgreSQL connection pool
 * may give different connections for the same session. Transactions overcome
 * this problem.
 *
 * @param tenantId string
 * @returns Prisma Client Extension with tenant context
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions
 */
// @ts-ignore
function tenantDbExtension(
  tenantId: string | null | undefined
): (client: any) => any {
  return Prisma.defineExtension((prisma) =>
    // @ts-ignore (Excessive stack depth comparing types...)
    prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            // set tenant context, if tenantId is provided
            // otherwise, reset it
            const [, result] = tenantId
              ? await prisma.$transaction([
                  prisma.$executeRawUnsafe(
                    `SET nile.tenant_id = '${tenantId}';`
                  ),
                  query(args),
                ])
              : await prisma.$transaction([
                  prisma.$executeRawUnsafe(`RESET nile.tenant_id;`),
                  query(args),
                ]);
            return result;
          },
        },
      },
    })
  );
}

// Middleware to extract tenantId from URL and set Nile context
app.use((req, res, next) => {
  console.log(`Processing request: ${req.method} ${req.path}`);
  
  // Extract tenantId from paths like /api/tenants/:tenantId/xxx
  let tenantId = null;
  const pathParts = req.path.split('/');
  if (pathParts.length >= 4 && pathParts[1] === 'api' && pathParts[2] === 'tenants') {
    tenantId = pathParts[3];
  }

  console.log(
    "Creating async storage with extended prisma client for tenantId: " + (tenantId || "N/A (system-level)")
  );
  
  try {
    // @ts-ignore
    tenantContext.run(
      prisma.$extends(tenantDbExtension(tenantId)) as PrismaClient,
      next
    );
  } catch (error) {
    console.error('Error in tenant context setup:', error);
    next(error);
  }
});

// Apply basic auth middleware if required, after tenant context is set
console.log(`REQUIRE_AUTH is set to: ${REQUIRE_AUTH}`);
if (REQUIRE_AUTH) {
  console.log('Setting up basic auth middleware...');
  app.use(
    expressBasicAuth({
      authorizer: dbAuthorizer,
      authorizeAsync: true,
      unauthorizedResponse: getUnauthorizedResponse
      // Note: exclude option is not available in express-basic-auth
      // You would need to conditionally apply the middleware to specific routes instead
    })
  );
} else {
  console.log('Basic auth is disabled');
}

// --- API Routes ---
console.log('Setting up API routes...');

// Nile Auth routes (new authentication system)
app.use('/api/auth', nileAuthRoutes);

app.use('/api', adminRoutes); // System Admin APIs (no tenantId in path)
app.use('/api/tenants/:tenantId', tenantRoutes); // Tenant-specific APIs with tenantId parameter

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AI Customer Service SaaS API Docs',
}));

console.log('API routes configured');

// Security: Removed insecure endpoint '/insecure/all_todos' 
// If you need debugging endpoints, create them with proper authentication

// Start the server
console.log('Starting server...');
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🚀 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`📚 API documentation available at http://localhost:${PORT}/api-docs`);
}).on('error', (error) => {
  console.error('❌ Failed to start server:', error);
});