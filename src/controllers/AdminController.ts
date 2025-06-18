import { Request, Response } from 'express';
import { AdminService } from '../services/AdminService.ts';
import TokenService from '../services/TokenService.ts';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RequestWithAuth } from '../middleware/auth.ts';

export class AdminController {
    private adminService: AdminService;
    private tokenService: TokenService;

    constructor(prisma: PrismaClient) {
        this.adminService = new AdminService(prisma);
        this.tokenService = new TokenService(prisma);
    }

    private getClientInfo(req: Request) {
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
        const userAgent = req.headers['user-agent'];        return { ipAddress, userAgent };
    }

    // Legacy cookie methods removed - authentication now handled by JWT tokens in headers
    // Cookies are no longer used for admin authentication

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
    };

    loginAdmin = async (req: Request, res: Response) => {
        const { email, password } = req.body;
        const { ipAddress, userAgent } = this.getClientInfo(req);
        
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
            // Check if admin is locked
            const isLocked = await this.tokenService.isAdminLocked(email);
            if (isLocked) {
                return res.status(423).json({
                    error: 'Account Locked',
                    message: 'Account is temporarily locked due to multiple failed login attempts',
                    code: 'ACCOUNT_LOCKED'
                });
            }

            // Get admin by email
            const admin = await this.adminService.getAdminByEmail(email);
            if (!admin) {
                await this.tokenService.recordFailedLogin(email, ipAddress);
                return res.status(401).json({ 
                    error: 'Authentication Failed',
                    message: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
            if (!isPasswordValid) {
                await this.tokenService.recordFailedLogin(email, ipAddress);
                return res.status(401).json({ 
                    error: 'Authentication Failed',
                    message: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Check if admin is active
            if (!admin.is_active) {
                return res.status(403).json({
                    error: 'Access Denied',
                    message: 'Admin account is inactive',
                    code: 'ACCOUNT_INACTIVE'
                });
            }

            // Generate JWT tokens
            const tokens = await this.tokenService.generateAdminTokens(
                admin.id,
                admin.email,
                admin.role,
                ipAddress,
                userAgent            );

            // Update last login
            await this.tokenService.updateAdminLastLogin(admin.id, ipAddress);

            // Cookies no longer used - authentication via JWT Bearer tokens only

            // Return success response
            const { password_hash, ...adminData } = admin;
            res.json({ 
                message: 'Login successful',
                admin: adminData,
                tokens,
                expiresIn: process.env.JWT_EXPIRES_IN || '15m'
            });

        } catch (error: any) {
            console.error('Admin login error:', error);
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: 'Unable to process login request',
                code: 'LOGIN_ERROR'
            });
        }
    };    logoutAdmin = async (req: RequestWithAuth, res: Response) => {
        try {
            // Revoke tokens if we have admin context
            if (req.authAdmin) {
                await this.tokenService.revokeAllAdminTokens(req.authAdmin.adminId);
            }

            // Cookies no longer used - tokens are revoked from database

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

    getCurrentAdmin = async (req: RequestWithAuth, res: Response) => {
        try {
            if (!req.authAdmin) {
                return res.status(401).json({ 
                    error: 'Unauthenticated',
                    message: 'Admin authentication required' 
                });
            }

            const admin = await this.adminService.getAdminById(req.authAdmin.adminId);
            if (!admin) {
                return res.status(404).json({ 
                    error: 'Not Found',
                    message: 'Admin not found' 
                });
            }

            res.json(admin);
        } catch (error: any) {
            console.error('Error getting current admin:', error);
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: 'Unable to get admin information' 
            });
        }
    };

    refreshToken = async (req: Request, res: Response) => {
        const { ipAddress, userAgent } = this.getClientInfo(req);
        
        try {
            const refreshToken = req.cookies?.admin_refresh_token || req.body.refreshToken;
            
            if (!refreshToken) {
                return res.status(401).json({
                    error: 'Refresh token required',
                    message: 'No refresh token provided'
                });
            }

            // Refresh the token
            const tokens = await this.tokenService.refreshAdminToken(
                refreshToken,
                ipAddress,                userAgent
            );

            // Cookies no longer used - authentication via JWT Bearer tokens only

            res.json({
                message: 'Token refreshed successfully',
                tokens,
                expiresIn: process.env.JWT_EXPIRES_IN || '15m'
            });

        } catch (error: any) {
            console.error('Token refresh error:', error);
            res.status(401).json({
                error: 'Token refresh failed',
                message: 'Invalid or expired refresh token'
            });
        }
    };

    // Utility method to revoke all tokens (for security purposes)
    revokeAllTokens = async (req: RequestWithAuth, res: Response) => {
        try {
            if (!req.authAdmin) {
                return res.status(401).json({ 
                    error: 'Unauthenticated',
                    message: 'Admin authentication required' 
                });
            }

            await this.tokenService.revokeAllAdminTokens(req.authAdmin.adminId);

            res.json({
                message: 'All tokens revoked successfully'
            });

        } catch (error: any) {
            console.error('Error revoking tokens:', error);
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: 'Unable to revoke tokens' 
            });
        }
    };
}
