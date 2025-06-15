import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: string;
        password: string;
      };
    }
  }
}

export {};
