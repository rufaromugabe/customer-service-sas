import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Express-validator validation
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation error',
            errors: errors.array()
        });
    }
    next();
};

export const validateQueryParams = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.query);
        if (error) {
            return res.status(400).json({
                message: 'Query validation error',
                details: error.details.map((detail: any) => detail.message)
            });
        }
        next();
    };
};

export const validateParams = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.params);
        if (error) {
            return res.status(400).json({
                message: 'Parameter validation error',
                details: error.details.map((detail: any) => detail.message)
            });
        }
        next();
    };
};
