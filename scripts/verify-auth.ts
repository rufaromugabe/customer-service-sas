#!/usr/bin/env node

/**
 * JWT Authentication Verification Script
 * This script analyzes all route files to ensure proper JWT authentication is applied
 */

import fs from 'fs';
import path from 'path';

interface RouteAnalysis {
    file: string;
    line: number;
    method: string;
    route: string; 
    hasAuth: boolean;
    authType: string;
    isPublic: boolean;
}

const routeFiles = [
    'src/routes/adminRoutes.ts',
    'src/routes/tenantRoutes.ts', 
    'src/routes/nileAuthRoutes.ts'
];

const authMiddleware = [
    'universalJWTAuth',
    'adminAuthMiddleware',
    'nileAuthMiddleware',
    'requireAdmin',
    'requireSuperAdmin',
    'requireUser',
    'requireTenantAccess'
];

const publicEndpoints = [
    '/auth/signin',
    '/auth/signup',
    '/auth/google',
    '/auth/github',
    '/auth/magic-link',
    '/health/public'
];

function analyzeRoutes(): RouteAnalysis[] {
    const results: RouteAnalysis[] = [];
    
    for (const filePath of routeFiles) {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  File not found: ${filePath}`);
            continue;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const routeMatch = line.match(/(router|adminRouter|tenantRouter|nileAuthRouter)\.(get|post|put|delete|patch)\s*\(/);
            
            if (routeMatch) {
                const method = routeMatch[2].toUpperCase();
                const routeString = extractRouteString(line);
                const hasAuth = authMiddleware.some(middleware => line.includes(middleware));
                const authType = authMiddleware.find(middleware => line.includes(middleware)) || 'none';
                const isPublic = publicEndpoints.some(endpoint => routeString.includes(endpoint));
                
                results.push({
                    file: filePath,
                    line: index + 1,
                    method,
                    route: routeString,
                    hasAuth,
                    authType,
                    isPublic
                });
            }
        });
    }
    
    return results;
}

function extractRouteString(line: string): string {
    const routeMatch = line.match(/['"]([^'"]+)['"]/) || [];
    return routeMatch[1] || 'unknown';
}

function generateReport(analysis: RouteAnalysis[]): void {
    console.log('\n🔒 JWT Authentication Security Report\n');
    console.log('=====================================\n');
    
    const unprotectedRoutes = analysis.filter(route => !route.hasAuth && !route.isPublic);
    const protectedRoutes = analysis.filter(route => route.hasAuth);
    const publicRoutes = analysis.filter(route => route.isPublic);
    
    if (unprotectedRoutes.length > 0) {
        console.log('🚨 UNPROTECTED ROUTES (SECURITY RISK):');
        console.log('======================================');
        unprotectedRoutes.forEach(route => {
            console.log(`❌ ${route.method} ${route.route}`);
            console.log(`   File: ${route.file}:${route.line}`);
            console.log('');
        });
    }
    
    console.log('✅ PROTECTED ROUTES:');
    console.log('====================');
    protectedRoutes.forEach(route => {
        console.log(`✅ ${route.method} ${route.route} [${route.authType}]`);
    });
    
    console.log('\n🌐 PUBLIC ROUTES:');
    console.log('=================');
    publicRoutes.forEach(route => {
        console.log(`🌐 ${route.method} ${route.route}`);
    });
    
    console.log('\n📊 SUMMARY:');
    console.log('===========');
    console.log(`Total routes analyzed: ${analysis.length}`);
    console.log(`Protected routes: ${protectedRoutes.length}`);
    console.log(`Public routes: ${publicRoutes.length}`);
    console.log(`Unprotected routes: ${unprotectedRoutes.length}`);
    
    if (unprotectedRoutes.length === 0) {
        console.log('\n🎉 All routes are properly secured!');
    } else {
        console.log(`\n⚠️  ${unprotectedRoutes.length} routes need authentication!`);
        process.exit(1);
    }
}

// Main execution
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
    const analysis = analyzeRoutes();
    generateReport(analysis);
}

export { analyzeRoutes, generateReport };
