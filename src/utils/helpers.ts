import { Request } from 'express';

export interface PaginationOptions {
    page: number;
    limit: number;
    offset: number;
}

export const getPaginationOptions = (req: Request): PaginationOptions => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
};

export const validateId = (id: string): boolean => {
    // UUID v4 validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

export const sanitizeString = (str: string): string => {
    return str.trim().replace(/[<>]/g, '');
};

export const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const maskEmail = (email: string): string => {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
        ? username.slice(0, 2) + '*'.repeat(username.length - 2)
        : username;
    return `${maskedUsername}@${domain}`;
};

export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

export const formatDateTime = (date: Date): string => {
    return date.toISOString();
};

export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const isExpired = (date: Date): boolean => {
    return date < new Date();
};
