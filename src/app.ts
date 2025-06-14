import express from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import expressBasicAuth from 'express-basic-auth';
import { match } from 'path-to-regexp';
import { tenantContext } from './storage.js';
import { dbAuthorizer, getUnauthorizedResponse, REQUIRE_AUTH } from './basicauth.js';
import dotenv from 'dotenv';
import adminRoutes from './routes/adminRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 3001;

const prisma = new PrismaClient({ log: ["query", "info", "warn", "error"] });
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
): (client: any) => PrismaClient<any, any, any, Prisma.DefaultArgs> {
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
  // Regex to match tenantId in API paths like /api/tenants/:tenantId/xxx
  const tenantPathMatcher = match("/api/tenants/:tenantId/*", {
    decode: decodeURIComponent,
  });
  const m = tenantPathMatcher(req.path);

  // @ts-ignore
  const tenantId = m?.params?.tenantId;
  console.log(
    "Creating async storage with extended prisma client for tenantId: " + tenantId || "N/A (system-level)"
  );
  // @ts-ignore
  tenantContext.run(
    prisma.$extends(tenantDbExtension(tenantId)) as PrismaClient,
    next
  );
});

// Apply basic auth middleware if required, after tenant context is set
if (REQUIRE_AUTH) {
  app.use(
    expressBasicAuth({
      authorizer: dbAuthorizer,
      authorizeAsync: true,
      unauthorizedResponse: getUnauthorizedResponse,
      // You might want to exclude certain public endpoints from basic auth, e.g., invitation acceptance
      exclude: ['/api/invitations/*'],
    })
  );
}

// --- API Routes ---
app.use('/api', adminRoutes); // System Admin APIs (no tenantId in path)
app.use('/api/tenants', tenantRoutes); // Tenant-specific APIs (tenantId expected in path)

// Insecure endpoint to get all todos for demonstration (not recommended for production)
app.get("/insecure/all_todos", async (req, res) => {
  try {
    const tenantDB = tenantContext.getStore();
    // This will fetch all todos without tenant filtering if the context is reset
    const todos = await (prisma as PrismaClient).todos.findMany(); // Use base prisma client here
    res.json(todos);
  } catch (error: any) {
    console.error("error in insecure endpoint: " + error.message);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));