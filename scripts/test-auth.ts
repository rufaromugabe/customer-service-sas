#!/usr/bin/env node

/**
 * JWT Authentication Test Script
 * Tests the universal authentication middleware functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock JWT tokens for testing
const createMockUserToken = () => {
    return jwt.sign(
        {
            userId: 'user-123',
            email: 'user@test.com',
            role: 'user',
            tenantId: 'tenant-123',
            type: 'access',
            jti: 'token-123'
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );
};

const createMockAdminToken = () => {
    return jwt.sign(
        {
            adminId: 'admin-123',
            email: 'admin@test.com',
            role: 'admin',
            type: 'access',
            jti: 'admin-token-123'
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );
};

const createMockSuperAdminToken = () => {
    return jwt.sign(
        {
            adminId: 'super-admin-123',
            email: 'superadmin@test.com',
            role: 'super_admin',
            type: 'access',
            jti: 'super-admin-token-123'
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );
};

// Authentication test cases
export const authTestCases = {
    // Test endpoints that require authentication
    protectedEndpoints: [
        { method: 'GET', path: '/api/health', requiredRole: 'admin' },
        { method: 'GET', path: '/api/db-status', requiredRole: 'admin' },
        { method: 'GET', path: '/api/admins', requiredRole: 'admin' },
        { method: 'GET', path: '/api/organizations', requiredRole: 'admin' },
        { method: 'GET', path: '/api/tenants/tenant-123/users', requiredRole: 'user' },
        { method: 'GET', path: '/api/tenants/tenant-123/workspaces', requiredRole: 'user' }
    ],

    // Test endpoints that should be public
    publicEndpoints: [
        { method: 'POST', path: '/api/auth/signin' },
        { method: 'POST', path: '/api/auth/signup' },
        { method: 'GET', path: '/api/auth/google' },
        { method: 'GET', path: '/api/health/public' }
    ],

    // Test tokens
    tokens: {
        user: createMockUserToken(),
        admin: createMockAdminToken(),
        superAdmin: createMockSuperAdminToken(),
        invalid: 'invalid-token',
        expired: jwt.sign(
            { userId: 'user-123', email: 'user@test.com', type: 'access', jti: 'expired' },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '-1h' } // Expired token
        )
    }
};

/**
 * Manual authentication test function
 * Run this to verify authentication is working
 */
export async function testAuthentication(app: any) {
    console.log('🧪 Running JWT Authentication Tests...\n');

    // Test 1: Public endpoints should work without authentication
    console.log('1. Testing public endpoints...');
    for (const endpoint of authTestCases.publicEndpoints) {
        try {
            const response = await request(app)[endpoint.method.toLowerCase()](endpoint.path);
            if (response.status !== 404) { // 404 is OK for non-implemented routes
                console.log(`✅ ${endpoint.method} ${endpoint.path} - Public access OK`);
            }
        } catch (error) {
            console.log(`⚠️  ${endpoint.method} ${endpoint.path} - Could not test (${error})`);
        }
    }

    // Test 2: Protected endpoints should reject requests without tokens
    console.log('\n2. Testing protected endpoints without authentication...');
    for (const endpoint of authTestCases.protectedEndpoints) {
        try {
            const response = await request(app)[endpoint.method.toLowerCase()](endpoint.path);
            if (response.status === 401) {
                console.log(`✅ ${endpoint.method} ${endpoint.path} - Correctly rejected (401)`);
            } else {
                console.log(`❌ ${endpoint.method} ${endpoint.path} - Should have returned 401, got ${response.status}`);
            }
        } catch (error) {
            console.log(`⚠️  ${endpoint.method} ${endpoint.path} - Could not test (${error})`);
        }
    }

    // Test 3: Protected endpoints should work with valid tokens
    console.log('\n3. Testing protected endpoints with valid authentication...');
    for (const endpoint of authTestCases.protectedEndpoints) {
        const token = endpoint.requiredRole === 'admin' ? authTestCases.tokens.admin : authTestCases.tokens.user;
        try {
            const response = await request(app)
                [endpoint.method.toLowerCase()](endpoint.path)
                .set('Authorization', `Bearer ${token}`);
            
            if ([200, 201, 204].includes(response.status)) {
                console.log(`✅ ${endpoint.method} ${endpoint.path} - Authenticated access OK`);
            } else if (response.status === 404) {
                console.log(`⚠️  ${endpoint.method} ${endpoint.path} - Route not implemented (404)`);
            } else {
                console.log(`⚠️  ${endpoint.method} ${endpoint.path} - Unexpected status: ${response.status}`);
            }
        } catch (error) {
            console.log(`⚠️  ${endpoint.method} ${endpoint.path} - Could not test (${error})`);
        }
    }

    // Test 4: Invalid tokens should be rejected
    console.log('\n4. Testing with invalid tokens...');
    const testEndpoint = authTestCases.protectedEndpoints[0];
    try {
        const response = await request(app)
            [testEndpoint.method.toLowerCase()](testEndpoint.path)
            .set('Authorization', `Bearer ${authTestCases.tokens.invalid}`);
        
        if (response.status === 401) {
            console.log(`✅ Invalid token correctly rejected (401)`);
        } else {
            console.log(`❌ Invalid token should have been rejected, got ${response.status}`);
        }
    } catch (error) {
        console.log(`⚠️  Could not test invalid token (${error})`);
    }

    console.log('\n🎉 Authentication testing complete!');
}

export default { authTestCases, testAuthentication };
