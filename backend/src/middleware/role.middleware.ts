import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { Role } from './auth.middleware';

// Usage: router.post('/transfers', authMiddleware, requireRole('WAREHOUSE_MANAGER', 'OWNER'), handler)
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenError(`Requires role: ${allowed.join(' or ')}`);
    }
    next();
  };
}

// Convenience: any staff role (shop, warehouse, owner) but not customer.
export const requireStaff = requireRole('SHOPKEEPER', 'WAREHOUSE_MANAGER', 'OWNER');

// Order administration belongs to the shop floor (and the owner). The warehouse
// manager handles stock, not customer orders.
export const requireOrderAdmin = requireRole('SHOPKEEPER', 'OWNER');

// Moving stock OUT of the warehouse + receiving new stock (purchase-in).
export const requireWarehouse = requireRole('WAREHOUSE_MANAGER', 'OWNER');
