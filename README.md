# Getting Started Locally

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

4.  **Configure Prisma:**
    *   Create the `prisma` directory and `schema.prisma` file.
    *   Run Prisma commands:
        ```bash
        npx prisma generate
        npx prisma db push # Or npx prisma migrate dev --name init for migrations
        ```
        The `db push` command will create the tables in your NilePostgres database based on the `schema.prisma`.

5.  **Run the application:**
    ```bash
    npm run dev
    ```
    Your Express server should now be running on `http://localhost:3001`.

### Testing the Endpoints (using `curl` examples)

Remember to replace `<user_id>` with an actual user ID (e.g., if `REQUIRE_AUTH` is true and you've created a user) or remove the `-u` flag if `REQUIRE_AUTH=false`.

**1. Create an Organization (Tenant) - Admin API**
(Requires `REQUIRE_AUTH=true` and a valid admin user set in `basicauth.ts` for demo)
```bash
curl --location --request POST 'http://localhost:3001/api/organizations' \
--header 'Content-Type: application/json' \
--user 'admin@example.com:password' \
--data-raw '{
    "name": "My First Customer Org"
}'
# Note the 'id' returned for subsequent tenant-specific calls
```

**2. Create a User (within the system, not yet assigned to tenant) - Admin API (or via OAuth)**
```bash
curl --location --request POST 'http://localhost:3001/api/admins' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "testuser@example.com",
    "password": "securepassword",
    "name": "Test User"
}'
# Note the 'id' of the user, you'll use this for basic auth as the username
```
*(For `dbAuthorizer`, the `username` is directly matched to `user.id` for simplicity. In a real app, `username` could be email and `password` would be hashed.)*

**3. Add User to Tenant - Tenant API**
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