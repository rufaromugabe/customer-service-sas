import { Request, Response, NextFunction } from 'express';

export interface ErrorWithStatus extends Error {
    status?: number;
    statusCode?: number;
}

export const errorHandler = (
    error: ErrorWithStatus,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error occurred:', error);

    // Default to 500 server error
    let status = error.status || error.statusCode || 500;
    let message = error.message || 'Internal Server Error';

    // Handle Prisma errors
    if (error.name === 'PrismaClientKnownRequestError') {
        status = 400;
        message = 'Database operation failed';
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
        status = 400;
        message = 'Validation failed';
    }

    // Handle authentication errors
    if (error.message.includes('Unauthorized') || error.message.includes('Authentication')) {
        status = 401;
    }

    // Handle authorization errors
    if (error.message.includes('Forbidden') || error.message.includes('Access denied')) {
        status = 403;
    }

    // Handle not found errors
    if (error.message.includes('Not found') || error.message.includes('not found')) {
        status = 404;
    }

    res.status(status).json({
        error: {
            message,
            status,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        }
    });
};

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            status: 404
        }
    });
};

export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
