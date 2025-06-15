import { Response } from 'express';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const successResponse = <T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200
): Response => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        message
    };
    return res.status(statusCode).json(response);
};

export const errorResponse = (
    res: Response,
    error: string,
    statusCode: number = 400
): Response => {
    const response: ApiResponse = {
        success: false,
        error
    };
    return res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
): Response => {
    const totalPages = Math.ceil(total / limit);
    const response: ApiResponse<T[]> = {
        success: true,
        data,
        message,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
    return res.status(200).json(response);
};

export const createdResponse = <T>(
    res: Response,
    data: T,
    message?: string
): Response => {
    return successResponse(res, data, message, 201);
};

export const noContentResponse = (res: Response): Response => {
    return res.status(204).send();
};
