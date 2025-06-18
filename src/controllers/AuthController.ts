import { Request, Response } from 'express';
import { UserService } from '../services/UserService.ts';
import TokenService from '../services/TokenService.ts';
import JWTService from '../utils/jwtService.ts';
import { PrismaClient } from '@prisma/client';
import { RequestWithAuth } from '../middleware/auth.ts';
import { v4 as uuidv4 } from 'uuid';

export class AuthController {
    private userService: UserService;
    private tokenService: TokenService;
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
        this.userService = new UserService(tenantDB);
        this.tokenService = new TokenService(tenantDB);
    }    private getClientInfo(req: Request) {
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
        const userAgent = req.headers['user-agent'];
        return { ipAddress, userAgent };
    }

    // Legacy cookie methods removed - authentication now handled by JWT tokens in headers
    // Cookies are no longer used for user authentication

    /**
     * Register a new user (for systems that allow self-registration)
     */
    register = async (req: Request, res: Response) => {
        const { name, email, family_name, given_name, picture } = req.body;
        
        if (!email) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Email is required',
                code: 'MISSING_EMAIL'
            });
        }

        try {
            // Check if user already exists
            const existingUser = await this.tenantDB.users.findFirst({
                where: { email }
            });

            if (existingUser) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: 'User with this email already exists',
                    code: 'USER_EXISTS'
                });
            }

            // Create new user
            const user = await this.userService.createUser({
                name,
                email,
                family_name,
                given_name,
                picture
            });

            // Generate JWT tokens
            const jti = uuidv4();
            const tokens = JWTService.generateTokenPair({
                userId: user.id,
                email: user.email!,
                role: 'user',                jti
            });

            // Cookies no longer used - authentication via JWT Bearer tokens only

            res.status(201).json({
                message: 'Registration successful',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    family_name: user.family_name,
                    given_name: user.given_name,
                    picture: user.picture
                },
                tokens,
                expiresIn: process.env.JWT_EXPIRES_IN || '15m'
            });

        } catch (error: any) {
            console.error('User registration error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Unable to register user',
                code: 'REGISTRATION_ERROR'
            });
        }
    };

    /**
     * Login user (for systems with custom authentication)
     */
    login = async (req: Request, res: Response) => {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Email is required',
                code: 'MISSING_EMAIL'
            });
        }

        try {
            // Find user by email
            const user = await this.tenantDB.users.findFirst({
                where: { 
                    email,
                    deleted: null,
                    is_active: true
                }
            });

            if (!user) {
                return res.status(401).json({
                    error: 'Authentication Failed',
                    message: 'User not found or inactive',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Update last login
            await this.tenantDB.users.update({
                where: { id: user.id },
                data: {
                    last_login_at: new Date(),
                    last_login_ip: this.getClientInfo(req).ipAddress
                }
            });

            // Generate JWT tokens
            const jti = uuidv4();
            const tokens = JWTService.generateTokenPair({
                userId: user.id,
                email: user.email!,
                role: 'user',                jti
            });

            // Cookies no longer used - authentication via JWT Bearer tokens only

            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    family_name: user.family_name,
                    given_name: user.given_name,
                    picture: user.picture
                },
                tokens,
                expiresIn: process.env.JWT_EXPIRES_IN || '15m'
            });

        } catch (error: any) {
            console.error('User login error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Unable to process login',
                code: 'LOGIN_ERROR'
            });
        }
    };

    /**
     * Logout user     */
    logout = async (req: RequestWithAuth, res: Response) => {
        try {
            // Cookies no longer used - tokens are managed server-side

            res.json({
                message: 'Logout successful',
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('User logout error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Unable to process logout'
            });
        }
    };

    /**
     * Get current user profile
     */
    getProfile = async (req: RequestWithAuth, res: Response) => {
        try {
            if (!req.authUser?.userId) {
                return res.status(401).json({
                    error: 'Unauthenticated',
                    message: 'User authentication required'
                });
            }

            const user = await this.userService.getUserById(req.authUser.userId);
            if (!user) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'User not found'
                });
            }

            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                family_name: user.family_name,
                given_name: user.given_name,
                picture: user.picture,
                is_active: user.is_active,
                last_login_at: user.last_login_at
            });

        } catch (error: any) {
            console.error('Error getting user profile:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Unable to get user profile'
            });
        }
    };    /**
     * Refresh user token
     */
    refreshToken = async (req: Request, res: Response) => {
        try {
            const refreshToken = req.body.refreshToken; // Only accept from request body now
            
            if (!refreshToken) {
                return res.status(401).json({
                    error: 'Refresh token required',
                    message: 'No refresh token provided'
                });
            }

            // Verify refresh token
            const decoded = JWTService.verifyRefreshToken(refreshToken);
            
            if (!JWTService.isUserPayload(decoded)) {
                return res.status(401).json({
                    error: 'Invalid token',
                    message: 'Invalid token type'
                });
            }

            // Get user
            const user = await this.userService.getUserById(decoded.userId);
            if (!user || !user.is_active) {
                return res.status(401).json({
                    error: 'User not found',
                    message: 'User not found or inactive'
                });
            }

            // Generate new tokens
            const jti = uuidv4();
            const tokens = JWTService.generateTokenPair({
                userId: user.id,
                email: user.email!,                role: 'user',
                jti
            });

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

    /**
     * Verify token (for API clients)
     */
    verifyToken = async (req: Request, res: Response) => {
        try {
            const token = JWTService.extractTokenFromHeader(req) || req.cookies?.access_token;
            
            if (!token) {
                return res.status(401).json({
                    error: 'Token required',
                    message: 'No token provided'
                });
            }

            const decoded = JWTService.verifyAccessToken(token);
            
            if (JWTService.isUserPayload(decoded)) {
                const user = await this.userService.getUserById(decoded.userId);
                if (!user || !user.is_active) {
                    return res.status(401).json({
                        error: 'User not found',
                        message: 'User not found or inactive'
                    });
                }

                res.json({
                    valid: true,
                    user: {
                        id: user.id,
                        email: user.email,
                        role: decoded.role,
                        tenantId: decoded.tenantId
                    },
                    expiresAt: decoded.exp
                });
            } else {
                return res.status(401).json({
                    error: 'Invalid token',
                    message: 'Invalid token type'
                });
            }

        } catch (error: any) {
            res.status(401).json({
                error: 'Invalid token',
                message: 'Token verification failed'
            });
        }
    };
}

export default AuthController;
