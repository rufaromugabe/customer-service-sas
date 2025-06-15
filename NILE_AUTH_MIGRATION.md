# Migration Guide: Nile Auth Integration

This document outlines the changes made to integrate Nile Auth into your customer service SaaS backend.

## Overview

Your authentication system has been updated to use **Nile Auth**, a modern multi-tenant authentication service. This provides better security, built-in tenant management, and OAuth integrations.

## Key Changes

### 1. New Authentication Routes

Authentication has been moved from tenant-specific routes to global routes:

**OLD (Deprecated):**
- `POST /api/tenants/{tenantId}/auth/google` → `POST /api/auth/google`
- `POST /api/tenants/{tenantId}/auth/logout` → `POST /api/auth/signout`
- `GET /api/tenants/{tenantId}/auth/me` → `GET /api/auth/me`
- `PUT /api/tenants/{tenantId}/auth/profile` → `PUT /api/auth/profile`

**NEW:**
- `POST /api/auth/signin` - Sign in with email/password
- `POST /api/auth/signup` - Sign up with email/password
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/tenants` - Get user's tenants
- `POST /api/auth/tenants` - Create new tenant

### 2. New Authentication Middleware

**Nile Auth Middleware:**
- `nileAuthMiddleware` - Require authentication
- `nileTenantMiddleware` - Require tenant access
- `nileAdminMiddleware` - Require admin access
- `nileOptionalAuthMiddleware` - Optional authentication

**Request Interface:**
```typescript
interface NileAuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  tenant?: {
    id: string;
    name?: string;
  };
  session?: any;
}
```

### 3. Configuration

**Environment Variables:**
```bash
# Nile Auth Configuration
NILE_API_URL=https://api.thenile.dev
NILE_WORKSPACE_ID=your-workspace-id
NILE_DATABASE_ID=your-database-id
NILE_API_TOKEN=your-api-token

# Nile Auth Settings
NILE_AUTH_COOKIE_NAME=nile-auth
NILE_AUTH_COOKIE_SECURE=true
NILE_AUTH_COOKIE_SAME_SITE=lax
```

### 4. Updated Routes

Selected routes have been updated to use Nile Auth:

**User Management:**
- `GET /api/tenants/{tenantId}/users` - Now uses `nileAuthMiddleware` + `nileTenantMiddleware`
- `POST /api/tenants/{tenantId}/users` - Now uses `nileAuthMiddleware` + `nileTenantMiddleware`

**Workspace Management:**
- `GET /api/tenants/{tenantId}/workspaces` - Now uses `nileAuthMiddleware` + `nileTenantMiddleware`
- `POST /api/tenants/{tenantId}/workspaces` - Now uses `nileAuthMiddleware` + `nileTenantMiddleware`

## Migration Steps

### For Frontend Applications

1. **Update Authentication Calls:**
   ```javascript
   // OLD
   POST /api/tenants/123/auth/logout
   
   // NEW
   POST /api/auth/signout
   ```

2. **Handle Session Cookies:**
   - Nile Auth uses HTTP-only cookies for session management
   - No need to manually handle JWT tokens
   - Cookies are automatically included in requests

3. **Update User Profile Access:**
   ```javascript
   // OLD
   GET /api/tenants/123/auth/me
   
   // NEW
   GET /api/auth/me
   ```

### For Backend Integration

1. **Use New Middleware:**
   ```typescript
   // OLD
   import { authenticateUser, validateTenantAccess } from './middleware/auth.ts';
   
   // NEW
   import { nileAuthMiddleware, nileTenantMiddleware } from './middleware/nileAuth.ts';
   
   // Apply to routes
   router.get('/protected-route', 
     nileAuthMiddleware,      // Authenticate user
     nileTenantMiddleware,    // Verify tenant access
     handler
   );
   ```

2. **Access User Data:**
   ```typescript
   // In route handlers
   const handler = (req: NileAuthRequest, res: Response) => {
     const userId = req.user?.id;
     const tenantId = req.tenant?.id;
     // Use user and tenant data
   };
   ```

## Authentication Flow

### 1. Sign Up
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "John Doe",
    "tenantId": "optional-tenant-id"
  }'
```

### 2. Sign In
```bash
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

### 3. Access Protected Routes
```bash
# Session cookie is automatically included
curl -X GET http://localhost:3001/api/auth/me \
  -H "Cookie: nile-auth=session-token-here"
```

## Backwards Compatibility

- Legacy authentication routes return HTTP 301 redirects
- Existing basic auth middleware is still available
- Gradual migration is supported

## Next Steps

1. **Configure Nile Workspace:** Set up your Nile workspace and get API credentials
2. **Update Frontend:** Migrate authentication calls to new endpoints
3. **Test Integration:** Verify authentication flow works correctly
4. **Enable OAuth:** Configure Google, GitHub, or other OAuth providers
5. **Remove Legacy Auth:** Once fully migrated, remove old authentication code

## OAuth Integration (Future)

Nile Auth supports multiple OAuth providers:
- Google OAuth
- GitHub OAuth  
- Discord OAuth
- LinkedIn OAuth
- HubSpot OAuth

Each can be configured through the Nile dashboard and will work automatically with the `/api/auth/google`, `/api/auth/github` endpoints.

## Support

- [Nile Auth Documentation](https://thenile.dev/docs/auth/)
- [Nile Auth SDK Reference](https://thenile.dev/docs/auth/sdk-reference/)
- [Migration Guide](https://thenile.dev/docs/auth/migration/)

## Security Improvements

✅ **Session-based authentication** with HTTP-only cookies  
✅ **CSRF protection** built-in  
✅ **Secure cookie handling** with SameSite protection  
✅ **Multi-tenant isolation** at the authentication layer  
✅ **OAuth integration** ready  
✅ **Password reset** and email verification support  
✅ **Rate limiting** and brute force protection  
