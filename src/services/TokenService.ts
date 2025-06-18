import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import JWTService, { JWTPayload, AdminJWTPayload } from '../utils/jwtService.ts';

export class TokenService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Create admin token record in database
     */
    async createAdminToken(
        adminId: string,
        tokenType: 'access_token' | 'refresh_token',
        jti: string,
        expiresAt: Date,
        ipAddress?: string,
        userAgent?: string
    ) {
        return await this.prisma.admin_tokens.create({
            data: {
                admin_id: adminId,
                token_type: tokenType,
                jti,
                expires_at: expiresAt,
                ip_address: ipAddress,
                user_agent: userAgent
            }
        });
    }

    /**
     * Generate admin login tokens
     */
    async generateAdminTokens(
        adminId: string,
        email: string,
        role: string,
        ipAddress?: string,
        userAgent?: string
    ) {
        const accessJti = uuidv4();
        const refreshJti = uuidv4();

        // Calculate expiry dates
        const accessExpiresAt = new Date();
        accessExpiresAt.setMinutes(accessExpiresAt.getMinutes() + 15); // 15 minutes

        const refreshExpiresAt = new Date();
        refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days

        // Generate JWT tokens
        const tokens = JWTService.generateAdminTokenPair({
            adminId,
            email,
            role,
            jti: accessJti
        });

        // Store token records in database
        await Promise.all([
            this.createAdminToken(adminId, 'access_token', accessJti, accessExpiresAt, ipAddress, userAgent),
            this.createAdminToken(adminId, 'refresh_token', refreshJti, refreshExpiresAt, ipAddress, userAgent)
        ]);

        return tokens;
    }

    /**
     * Validate admin token
     */
    async validateAdminToken(jti: string, tokenType: 'access_token' | 'refresh_token'): Promise<boolean> {
        const tokenRecord = await this.prisma.admin_tokens.findUnique({
            where: { jti },
            include: { admin: true }
        });

        if (!tokenRecord) {
            return false;
        }

        // Check if token is revoked
        if (tokenRecord.revoked_at) {
            return false;
        }

        // Check if token is expired
        if (tokenRecord.expires_at < new Date()) {
            return false;
        }

        // Check if token type matches
        if (tokenRecord.token_type !== tokenType) {
            return false;
        }

        // Check if admin is active
        if (!tokenRecord.admin.is_active) {
            return false;
        }

        return true;
    }

    /**
     * Revoke token
     */
    async revokeToken(jti: string) {
        return await this.prisma.admin_tokens.update({
            where: { jti },
            data: { revoked_at: new Date() }
        });
    }

    /**
     * Revoke all tokens for admin
     */
    async revokeAllAdminTokens(adminId: string) {
        return await this.prisma.admin_tokens.updateMany({
            where: { 
                admin_id: adminId,
                revoked_at: null 
            },
            data: { revoked_at: new Date() }
        });
    }

    /**
     * Clean up expired tokens
     */
    async cleanupExpiredTokens() {
        return await this.prisma.admin_tokens.deleteMany({
            where: {
                expires_at: {
                    lt: new Date()
                }
            }
        });
    }

    /**
     * Refresh admin token
     */
    async refreshAdminToken(
        refreshToken: string,
        ipAddress?: string,
        userAgent?: string
    ) {
        try {
            // Verify refresh token
            const decoded = JWTService.verifyRefreshToken(refreshToken) as AdminJWTPayload;
            
            // Validate token in database
            const isValid = await this.validateAdminToken(decoded.jti, 'refresh_token');
            if (!isValid) {
                throw new Error('Invalid refresh token');
            }

            // Get admin details
            const admin = await this.prisma.admins.findUnique({
                where: { id: decoded.adminId }
            });

            if (!admin || !admin.is_active) {
                throw new Error('Admin not found or inactive');
            }

            // Revoke old tokens
            await this.revokeToken(decoded.jti);

            // Generate new tokens
            return await this.generateAdminTokens(
                admin.id,
                admin.email,
                admin.role,
                ipAddress,
                userAgent
            );
        } catch (error) {
            throw new Error('Failed to refresh token');
        }
    }

    /**
     * Get admin from token
     */
    async getAdminFromToken(token: string) {
        try {
            const decoded = JWTService.verifyAccessToken(token) as AdminJWTPayload;
            
            // Validate token in database
            const isValid = await this.validateAdminToken(decoded.jti, 'access_token');
            if (!isValid) {
                return null;
            }

            // Get admin details
            return await this.prisma.admins.findUnique({
                where: { id: decoded.adminId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    is_active: true,
                    last_login_at: true
                }
            });
        } catch (error) {
            return null;
        }
    }

    /**
     * Update admin last login
     */
    async updateAdminLastLogin(adminId: string, ipAddress?: string) {
        return await this.prisma.admins.update({
            where: { id: adminId },
            data: {
                last_login_at: new Date(),
                last_login_ip: ipAddress,
                failed_attempts: 0 // Reset failed attempts on successful login
            }
        });
    }

    /**
     * Record failed login attempt
     */
    async recordFailedLogin(email: string, ipAddress?: string) {
        const admin = await this.prisma.admins.findUnique({
            where: { email }
        });

        if (admin) {
            const failedAttempts = admin.failed_attempts + 1;
            const shouldLock = failedAttempts >= 5;
            
            return await this.prisma.admins.update({
                where: { id: admin.id },
                data: {
                    failed_attempts: failedAttempts,
                    locked_until: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null // Lock for 15 minutes
                }
            });
        }
    }

    /**
     * Check if admin is locked
     */
    async isAdminLocked(email: string): Promise<boolean> {
        const admin = await this.prisma.admins.findUnique({
            where: { email }
        });

        if (!admin) {
            return false;
        }

        if (admin.locked_until && admin.locked_until > new Date()) {
            return true;
        }

        return false;
    }
}

export default TokenService;
