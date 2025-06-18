import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { Request } from 'express';

export interface JWTPayload extends JwtPayload {
    userId: string;
    email: string;
    role?: string;
    tenantId?: string;
    type: 'access' | 'refresh';
    jti: string; // JWT ID for token tracking
}

export interface AdminJWTPayload extends JwtPayload {
    adminId: string;
    email: string;
    role?: string;
    type: 'access' | 'refresh';
    jti: string;
}

export class JWTService {
    private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-super-secret-refresh-key';
    private static readonly ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
    private static readonly REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    /**
     * Generate access token for regular users
     */
    static generateAccessToken(payload: {
        userId: string;
        email: string;
        role?: string;
        tenantId?: string;
        jti: string;
    }): string {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            tenantId: payload.tenantId,
            type: 'access' as const,
            jti: payload.jti
        };        const options = {
            expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
            issuer: 'customer-service-saas',
            audience: 'customer-service-app'
        } as SignOptions;

        return jwt.sign(tokenPayload, this.ACCESS_TOKEN_SECRET, options);
    }

    /**
     * Generate refresh token for regular users
     */
    static generateRefreshToken(payload: {
        userId: string;
        email: string;
        jti: string;
    }): string {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
            type: 'refresh' as const,
            jti: payload.jti
        };        const options = {
            expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
            issuer: 'customer-service-saas',
            audience: 'customer-service-app'
        } as SignOptions;

        return jwt.sign(tokenPayload, this.REFRESH_TOKEN_SECRET, options);
    }

    /**
     * Generate access token for admin users
     */
    static generateAdminAccessToken(payload: {
        adminId: string;
        email: string;
        role: string;
        jti: string;
    }): string {
        const tokenPayload = {
            adminId: payload.adminId,
            email: payload.email,
            role: payload.role,
            type: 'access' as const,
            jti: payload.jti
        };        const options = {
            expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
            issuer: 'customer-service-saas',
            audience: 'customer-service-admin'
        } as SignOptions;

        return jwt.sign(tokenPayload, this.ACCESS_TOKEN_SECRET, options);
    }

    /**
     * Generate refresh token for admin users
     */
    static generateAdminRefreshToken(payload: {
        adminId: string;
        email: string;
        jti: string;
    }): string {
        const tokenPayload = {
            adminId: payload.adminId,
            email: payload.email,
            type: 'refresh' as const,
            jti: payload.jti
        };        const options = {
            expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
            issuer: 'customer-service-saas',
            audience: 'customer-service-admin'
        } as SignOptions;

        return jwt.sign(tokenPayload, this.REFRESH_TOKEN_SECRET, options);
    }

    /**
     * Verify access token
     */
    static verifyAccessToken(token: string): JWTPayload | AdminJWTPayload {
        try {
            const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
                issuer: 'customer-service-saas'
            }) as JWTPayload | AdminJWTPayload;
            
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }
            
            return decoded;
        } catch (error) {
            throw new Error('Invalid or expired access token');
        }
    }

    /**
     * Verify refresh token
     */
    static verifyRefreshToken(token: string): JWTPayload | AdminJWTPayload {
        try {
            const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
                issuer: 'customer-service-saas'
            }) as JWTPayload | AdminJWTPayload;
            
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            
            return decoded;
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    /**
     * Extract token from Authorization header
     */
    static extractTokenFromHeader(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.slice('Bearer '.length);
    }

    /**
     * Extract token from cookies
     */
    static extractTokenFromCookies(req: Request, cookieName: string): string | null {
        return req.cookies?.[cookieName] || null;
    }

    /**
     * Generate token pair (access + refresh)
     */
    static generateTokenPair(payload: {
        userId: string;
        email: string;
        role?: string;
        tenantId?: string;
        jti: string;
    }) {
        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken({
                userId: payload.userId,
                email: payload.email,
                jti: payload.jti
            })
        };
    }

    /**
     * Generate admin token pair (access + refresh)
     */
    static generateAdminTokenPair(payload: {
        adminId: string;
        email: string;
        role: string;
        jti: string;
    }) {
        return {
            accessToken: this.generateAdminAccessToken(payload),
            refreshToken: this.generateAdminRefreshToken({
                adminId: payload.adminId,
                email: payload.email,
                jti: payload.jti
            })
        };
    }

    /**
     * Check if user payload (not admin)
     */
    static isUserPayload(payload: JWTPayload | AdminJWTPayload): payload is JWTPayload {
        return 'userId' in payload;
    }

    /**
     * Check if admin payload
     */
    static isAdminPayload(payload: JWTPayload | AdminJWTPayload): payload is AdminJWTPayload {
        return 'adminId' in payload;
    }
}

export default JWTService;
