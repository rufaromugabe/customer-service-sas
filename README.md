# AI Customer Service SaaS Backend

Multi-tenant AI customer service backend with **Nile Auth** integration, enhanced security, and enterprise-grade authentication.

## 🚀 New: Enhanced Security & Authentication

This backend now features **dual authentication systems** with enterprise-grade security:

### 🔐 User Authentication (Nile Auth)
- 🍪 Session-based authentication with secure HTTP-only cookies
- 🏢 Multi-tenant isolation at the auth layer  
- 🔑 OAuth integrations (Google, GitHub, etc.)
- 📧 Magic link authentication
- 🛡️ Built-in CSRF protection
- 📱 Password reset and email verification

### 👨‍💼 Admin Authentication (JWT-based)
- 🎫 JWT access & refresh tokens with secure cookies
- 🔒 Role-based access control (admin, super_admin)
- 🚫 Rate limiting & brute-force protection
- 🔄 Automatic token refresh
- 🔐 Enhanced session security

### 🛡️ Security Features
- 🚦 Configurable rate limiting per endpoint type
- 🛡️ Security headers via Helmet.js
- 🌐 CORS protection with origin validation
- 🧹 Input sanitization against injection attacks
- 📏 Request size limiting (10MB default)
- 📊 IP tracking for audit logging
- ⚠️ Security-conscious error responses

**Quick Start:**
1. **Users:** Sign up: `POST /api/auth/signup` → Sign in: `POST /api/auth/signin`
2. **Admins:** Login: `POST /api/auth/admin/login` → Access with JWT cookies
3. Access protected routes with session/JWT cookies

See [NILE_AUTH_MIGRATION.md](./NILE_AUTH_MIGRATION.md) for complete migration guide.

## Getting Started Locally

1.  **Clone the repository (or create files manually):**
    ```bash
    mkdir ai-customer-service-saas
    cd ai-customer-service-saas
    # Create the files as shown above
    ```

2.  **Initialize npm and install dependencies:**
    ```bash
   npm init -y
   
    npm install express @prisma/client dotenv path-to-regexp uuid express-basic-auth openai pg postgres
    npm install --save-dev typescript ts-node prisma @types/express @types/pg @types/uuid @types/bcryptjs bcryptjs
    ```
    *(Note: `bcryptjs` is added for password hashing for `admins` table.)*

3.  **Create `.env` file:** Copy content from `.env.example` and fill in your NilePostgres `DATABASE_URL` and AI API credentials.

4.  **Configure Nile Auth:** Add Nile configuration to your `.env` file:
    ```bash
    # Nile Auth Configuration  
    NILE_API_URL=https://api.thenile.dev
    NILE_WORKSPACE_ID=your-workspace-id
    NILE_DATABASE_ID=your-database-id
    NILE_API_TOKEN=your-api-token
    ```

5.  **Configure Prisma:**
    *   Create the `prisma` directory and `schema.prisma` file.
    *   Run Prisma commands:
        ```bash
        npx prisma generate
        npx prisma db push # Or npx prisma migrate dev --name init for migrations
        ```
        The `db push` command will create the tables in your NilePostgres database based on the `schema.prisma`.

6.  **Run the application:**
    ```bash
    npm run dev
    ```
    Your Express server should now be running on `http://localhost:3001`.

### Testing the Endpoints (using `curl` examples)

**Authentication Methods:**
- **JWT Admin Authentication**: Use `/api/auth/admin/login` to get tokens, then use Bearer token in Authorization header
- **Nile User Authentication**: Use `/api/auth/signin` for user authentication with session cookies

**1. Admin Login & Get Token**
```bash
# First, login as admin to get JWT token
curl --location --request POST 'http://localhost:3001/api/auth/admin/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "admin@example.com",
    "password": "your-password"
}'

# Use the returned access token in subsequent requests
```

**2. Create an Organization (Tenant) - Admin API**
```bash
curl --location --request POST 'http://localhost:3001/api/organizations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--data-raw '{
    "name": "My First Customer Org"
}'
# Note the 'id' returned for subsequent tenant-specific calls
```

**4. Create a User (within the system, not yet assigned to tenant) - Admin API**
```bash
curl --location --request POST 'http://localhost:3001/api/admins' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
--data-raw '{
    "email": "testuser@example.com",
    "password": "securepassword",
    "name": "Test User"
}'
```

**5. Add User to Tenant - Tenant API**
(Using the organization `id` from step 1, and user `id` from step 2)
```bash
curl --location --request POST 'http://localhost:3001/api/tenants/<ORGANIZATION_ID>/users' \
--header 'Content-Type: application/json' \
--user '<USER_ID_FROM_STEP_2>:' \
--data-raw '{
    "userId": "<USER_ID_FROM_STEP_2>",
    "roles": ["admin", "agent"]
}'
```

**4. Create a Customer Interaction (using 'todos' table for AI demo) - Tenant API**
```bash
curl --location --request POST 'http://localhost:3001/api/tenants/<ORGANIZATION_ID>/customer-interactions' \
--header 'Content-Type: application/json' \
--user '<USER_ID_FROM_STEP_2>:' \
--data-raw '{
    "title": "Customer complaint about slow delivery",
    "complete": false
}'
```

**5. List Customer Interactions for a Tenant - Tenant API**
```bash
curl --location --request GET 'http://localhost:3001/api/tenants/<ORGANIZATION_ID>/customer-interactions' \
--user '<USER_ID_FROM_STEP_2>:'
```