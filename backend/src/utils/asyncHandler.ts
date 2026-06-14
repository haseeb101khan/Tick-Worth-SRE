import { Request, Response, NextFunction, RequestHandler } from 'express';

// Wraps async route handlers so thrown errors reach the error middleware
// (Express 4 does not forward rejected promises automatically).
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
