import { Request, Response } from 'express';
import { AdminService } from '../services/AdminService.ts';
import { PrismaClient } from '@prisma/client';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface AdminAuthRequest extends Request {
    admin?: {
        id: string;
        email: string;
        name?: string;
        role: 'admin' | 'super_admin';
    };
}

export class AdminController {
    private adminService: AdminService;
    private jwtSecret: string;
    private jwtExpiresIn: string;

    constructor(prisma: PrismaClient) {
        this.adminService = new AdminService(prisma);
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        
        if (this.jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
            console.warn('⚠️  WARNING: Using default JWT secret. Please set JWT_SECRET environment variable in production!');
        }
    }    private generateAccessToken(admin: { id: string; email: string; name?: string | null }): string {
        const payload = { 
            id: admin.id, 
            email: admin.email, 
            name: admin.name || undefined, // Convert null to undefined
            role: 'admin',
            type: 'admin_access_token',
            iat: Math.floor(Date.now() / 1000)
        };
        
        return jwt.sign(payload, this.jwtSecret, { expiresIn: '24h' });
    }

    private generateRefreshToken(admin: { id: string; email: string }): string {
        const payload = { 
            id: admin.id, 
            email: admin.email,
            type: 'admin_refresh_token',
            iat: Math.floor(Date.now() / 1000)
        };
        
        return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
    }

    private setSecureCookies(res: Response, accessToken: string, refreshToken: string): void {
        const isProduction = process.env.NODE_ENV === 'production';
        
        // Set access token cookie (shorter expiry)
        res.cookie('admin_access_token', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/api',
        });

        // Set refresh token cookie (longer expiry)
        res.cookie('admin_refresh_token', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/api/auth/admin',
        });
    }

    getAllAdmins = async (req: Request, res: Response) => {
        try {
            const admins = await this.adminService.getAllAdmins();
            res.json(admins);
        } catch (error: any) {
            console.error('Error listing admins:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getAdminById = async (req: Request, res: Response) => {
        try {
            const admin = await this.adminService.getAdminById(req.params.id);
            if (!admin) {
                return res.status(404).json({ message: 'Admin not found.' });
            }
            res.json(admin);
        } catch (error: any) {
            console.error('Error getting admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createAdmin = async (req: Request, res: Response) => {
        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        try {
            const newAdmin = await this.adminService.createAdmin(email, password, name);
            res.status(201).json(newAdmin);
        } catch (error: any) {
            console.error('Error creating admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateAdmin = async (req: Request, res: Response) => {
        const { name, password } = req.body;
        try {
            const updatedAdmin = await this.adminService.updateAdmin(req.params.id, { name, password });
            res.json(updatedAdmin);
        } catch (error: any) {
            console.error('Error updating admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteAdmin = async (req: Request, res: Response) => {
        try {
            await this.adminService.deleteAdmin(req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };    loginAdmin = async (req: Request, res: Response) => {
        const { email, password } = req.body;
        
        // Input validation
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Bad Request',
                message: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid email format',
                code: 'INVALID_EMAIL'
            });
        }

        try {
            // Rate limiting should be implemented here in production
            // For example, using express-rate-limit or Redis
            
            const admin = await this.adminService.validateAdmin(email, password);
            if (!admin) {
                // Use the same response time for invalid credentials to prevent timing attacks
                await new Promise(resolve => setTimeout(resolve, 100));
                
                return res.status(401).json({ 
                    error: 'Authentication Failed',
                    message: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Generate tokens
            const accessToken = this.generateAccessToken(admin);
            const refreshToken = this.generateRefreshToken(admin);

            // Set secure cookies
            this.setSecureCookies(res, accessToken, refreshToken);            // Log successful login (for audit purposes)
            console.log(`Admin login successful: ${admin.email} at ${new Date().toISOString()}`);

            // Return success response (admin data is already clean from service)
            res.json({ 
                message: 'Login successful',
                admin: admin,
                accessToken, // Include token for API clients that prefer headers over cookies
                expiresIn: this.jwtExpiresIn
            });

        } catch (error: any) {
            console.error('Admin login error:', error);
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: 'Unable to process login request',
                code: 'LOGIN_ERROR'
            });
        }
    };

    logoutAdmin = async (req: Request, res: Response) => {
        try {
            // Clear secure cookies
            res.clearCookie('admin_access_token', { 
                path: '/api',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
            
            res.clearCookie('admin_refresh_token', { 
                path: '/api/auth/admin',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            // In a production system, you might want to:
            // 1. Add the JWT to a blacklist/revocation list
            // 2. Log the logout event for audit purposes

            res.json({ 
                message: 'Logout successful',
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Admin logout error:', error);
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: 'Unable to process logout request'
            });
        }
    };

    getCurrentAdmin = async (req: AdminAuthRequest, res: Response) => {
        try {
            if (!req.admin) {
                return res.status(401).json({ 
                    error: 'Unauthorized',
                    message: 'Admin authentication required',
                    code: 'NO_AUTH'
                });
            }

            // Fetch fresh admin data from database
            const admin = await this.adminService.getAdminById(req.admin.id);
            if (!admin) {
                return res.status(404).json({ 
                    error: 'Not Found',
                    message: 'Admin account not found',
                    code: 'ADMIN_NOT_FOUND'
                });
            }            // Return admin info (data is already clean from service)
            res.json({
                admin: admin,
                permissions: ['admin'], // Could be expanded based on role system
                lastLogin: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Get current admin error:', error);
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: 'Unable to fetch admin information'
            });
        }
    };

    refreshToken = async (req: Request, res: Response) => {
        try {
            const refreshToken = req.cookies.admin_refresh_token;
            
            if (!refreshToken) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Refresh token required',
                    code: 'NO_REFRESH_TOKEN'
                });
            }

            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;
            
            if (decoded.type !== 'admin_refresh_token') {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid refresh token type',
                    code: 'INVALID_TOKEN_TYPE'
                });
            }

            // Get admin data
            const admin = await this.adminService.getAdminById(decoded.id);
            if (!admin) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Admin account not found',
                    code: 'ADMIN_NOT_FOUND'
                });
            }

            // Generate new access token
            const newAccessToken = this.generateAccessToken(admin);
              // Set new access token cookie
            res.cookie('admin_access_token', newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                path: '/api',
            });

            // Return response with admin data (already clean from service)
            res.json({
                message: 'Token refreshed successfully',
                admin: admin,
                accessToken: newAccessToken,
                expiresIn: this.jwtExpiresIn
            });

        } catch (error: any) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid or expired refresh token',
                    code: 'INVALID_REFRESH_TOKEN'
                });
            }

            console.error('Token refresh error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Unable to refresh token'
            });
        }
    };
}
