import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// One structured line per request: method, path, status, duration, and the auth'd user
// (populated by authMiddleware on protected routes). 4xx/5xx are logged at warn level.
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const who = req.user ? `user=${req.user.id}(${req.user.role})` : 'anon';
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms ${who}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });
  next();
}
