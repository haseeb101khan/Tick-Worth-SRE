import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole, requireOrderAdmin } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const orderRoutes = Router();

orderRoutes.post('/', authMiddleware, requireRole('CUSTOMER'), asyncHandler(orderController.place));
orderRoutes.get('/my', authMiddleware, requireRole('CUSTOMER'), asyncHandler(orderController.myOrders));
// Order admin is shop-floor + owner; the warehouse manager has no order access.
orderRoutes.get('/all', authMiddleware, requireOrderAdmin, asyncHandler(orderController.allOrders));
orderRoutes.patch('/:id/status', authMiddleware, requireOrderAdmin, asyncHandler(orderController.updateStatus));
// Cancel: order admin (shopkeeper/owner) OR the owning customer — enforced in the service.
orderRoutes.post('/:id/cancel', authMiddleware, asyncHandler(orderController.cancel));
