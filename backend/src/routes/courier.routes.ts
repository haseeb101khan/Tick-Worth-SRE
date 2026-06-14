import { Router } from 'express';
import * as courierController from '../controllers/courier.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireOrderAdmin } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const courierRoutes = Router();

// Couriers are part of order fulfilment — managed by order admins (shopkeeper / owner).
courierRoutes.get('/', authMiddleware, requireOrderAdmin, asyncHandler(courierController.list));
courierRoutes.post('/', authMiddleware, requireOrderAdmin, asyncHandler(courierController.create));
courierRoutes.patch('/:id', authMiddleware, requireOrderAdmin, asyncHandler(courierController.update));
