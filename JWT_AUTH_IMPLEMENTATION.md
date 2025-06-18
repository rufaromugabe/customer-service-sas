# JWT Authentication Implementation

This document describes the JWT authentication system implemented in the customer service SaaS application.

## Overview

The application now supports JWT-based authentication for both admin users and regular users with the following features:

- Secure JWT token generation with proper expiration
- Refresh token support for seamless token renewal
- Database token tracking for security and revocation
- Account lockout protection against brute force attacks
- Secure HTTP-only cookie support
- Role-based access control
- Multi-tenant user isolation

## Architecture

### Components

1. **JWTService** (`src/utils/jwtService.ts`) - Core JWT token operations
2. **TokenService** (`src/services/TokenService.ts`) - Database token management
3. **AuthController** (`src/controllers/AuthController.ts`) - User authentication endpoints
4. **AdminController** (`src/controllers/AdminController.ts`) - Admin authentication endpoints
5. **Auth Middleware** (`src/middleware/auth.ts`) - Request authentication and authorization

### Token Types

- **Access Tokens**: Short-lived (15 minutes) for API access
- **Refresh Tokens**: Long-lived (7 days) for token renewal
- **Admin Tokens**: Special tokens with admin-specific claims
- **User Tokens**: Regular user tokens with tenant context

## Authentication Flow

### Admin Login Flow

1. **POST** `/api/auth/admin/login`
   ```json
   {
     "email": "admin@example.com",
     "password": "securePassword"
   }
   ```

2. **Response** includes tokens and sets secure cookies:
   ```json
   {
     "message": "Login successful",
     "admin": {
       "id": "admin-uuid",
       "email": "admin@example.com",
       "name": "Admin User",
       "role": "admin"
     },
     "tokens": {
       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     },
     "expiresIn": "15m"
   }
   ```

### User Authentication Flow

1. **POST** `/api/auth/login` (for custom auth) or
2. **POST** `/api/auth/register` (for user registration)

### Token Refresh

1. **POST** `/api/auth/admin/refresh` or `/api/auth/refresh`
   - Uses refresh token from cookie or request body
   - Returns new access and refresh tokens

### Logout

1. **POST** `/api/auth/admin/logout` or `/api/auth/logout`
   - Revokes tokens from database
   - Clears secure cookies

## Usage Examples

### Using Bearer Token in Headers

```bash
# Login first
curl -X POST http://localhost:3000/api/auth/admin/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@example.com", "password": "password"}'

# Use the access token for authenticated requests
curl -X GET http://localhost:3000/api/auth/admin/me \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Using Cookies (Automatic)

```bash
# Login with cookie jar
curl -X POST http://localhost:3000/api/auth/admin/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@example.com", "password": "password"}' \\
  -c cookies.txt

# Subsequent requests use cookies automatically
curl -X GET http://localhost:3000/api/auth/admin/me -b cookies.txt
```

### Frontend JavaScript Example

```javascript
// Login
const loginResponse = await fetch('/api/auth/admin/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Include cookies
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password'
  })
});

const loginData = await loginResponse.json();

// Make authenticated requests (cookies are automatically included)
const profileResponse = await fetch('/api/auth/admin/me', {
  credentials: 'include'
});

// Or use Bearer token
const profileResponse = await fetch('/api/auth/admin/me', {
  headers: {
    'Authorization': `Bearer ${loginData.tokens.accessToken}`
  }
});
```

## Middleware Usage

### Protecting Routes

```typescript
import { adminAuthMiddleware, authMiddleware } from '../middleware/auth.js';

// Admin only routes
router.get('/admin/users', adminAuthMiddleware, getUsersController);

// Regular user routes
router.get('/profile', authMiddleware, getProfileController);

// Super admin only
router.delete('/admin/:id', superAdminAuthMiddleware, deleteAdminController);

// Optional authentication (public with optional user context)
router.get('/public-data', optionalAuthMiddleware, getPublicDataController);
```

### Accessing User Context

```typescript
import { RequestWithAuth } from '../middleware/auth.js';

const controller = async (req: RequestWithAuth, res: Response) => {
  // For regular users
  if (req.authUser) {
    console.log('User:', req.authUser.email);
    console.log('User ID:', req.authUser.userId);
    console.log('Tenant:', req.authUser.tenantId);
  }

  // For admin users
  if (req.authAdmin) {
    console.log('Admin:', req.authAdmin.email);
    console.log('Admin ID:', req.authAdmin.adminId);
    console.log('Role:', req.authAdmin.role);
  }
};
```

## Security Features

### Account Lockout

- Failed login attempts are tracked
- Accounts are locked for 15 minutes after 5 failed attempts
- Lockout status is checked before authentication

### Token Revocation

- All tokens are tracked in the database
- Tokens can be revoked individually or in bulk
- Logout revokes all tokens for the user
- Admin can revoke all tokens from all devices

### Secure Cookies

- HTTP-only cookies prevent XSS attacks
- Secure flag in production (HTTPS only)
- SameSite=strict prevents CSRF attacks
- Proper path restrictions

### Environment Variables

Required environment variables:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production-at-least-256-bits-long
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-different-from-access
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Environment
NODE_ENV=production  # Enables secure cookies and other production features
```

## Database Schema

The authentication system uses the following database tables:

### admin_tokens table

```sql
- id: UUID (Primary key)
- admin_id: UUID (Foreign key to admins.id)
- token_type: String ('access_token' | 'refresh_token')
- jti: String (JWT ID, unique)
- expires_at: DateTime
- revoked_at: DateTime (nullable)
- created_at: DateTime
- ip_address: String (nullable)
- user_agent: String (nullable)
```

### admins table (enhanced)

```sql
- id: UUID (Primary key)
- email: String (unique)
- password_hash: String
- name: String (nullable)
- role: String ('admin' | 'super_admin')
- is_active: Boolean
- last_login_at: DateTime (nullable)
- last_login_ip: String (nullable)
- failed_attempts: Integer
- locked_until: DateTime (nullable)
- created: DateTime
- updated: DateTime
```

## Error Handling

Common error responses:

```json
// Invalid credentials
{
  "error": "Authentication Failed",
  "message": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}

// Account locked
{
  "error": "Account Locked",
  "message": "Account is temporarily locked due to multiple failed login attempts",
  "code": "ACCOUNT_LOCKED"
}

// Expired token
{
  "error": "Authentication failed",
  "message": "Invalid or expired token"
}

// Missing token
{
  "error": "Authentication required",
  "message": "No token provided"
}
```

## Best Practices

1. **Always use HTTPS in production**
2. **Keep JWT secrets secure and rotate them regularly**
3. **Use short-lived access tokens (15 minutes or less)**
4. **Implement proper error handling**
5. **Log authentication events for audit purposes**
6. **Use rate limiting on authentication endpoints**
7. **Validate input thoroughly**
8. **Implement CORS properly for web clients**

## Testing

You can test the authentication system using the following tools:

1. **Postman/Thunder Client** - For API testing
2. **curl** - For command line testing
3. **Jest/Vitest** - For automated testing

Example test:

```javascript
describe('Admin Authentication', () => {
  test('should login successfully with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/admin/login')
      .send({
        email: 'admin@test.com',
        password: 'validPassword'
      });
      
    expect(response.status).toBe(200);
    expect(response.body.tokens).toBeDefined();
    expect(response.body.admin.email).toBe('admin@test.com');
  });
});
```

This JWT authentication system provides a robust, secure foundation for your customer service SaaS application with proper token management, security features, and scalability.
