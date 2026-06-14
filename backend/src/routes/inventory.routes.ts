import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireStaff, requireWarehouse } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const inventoryRoutes = Router();

inventoryRoutes.get('/', authMiddleware, requireStaff, asyncHandler(inventoryController.list));
inventoryRoutes.get('/low-stock', authMiddleware, requireStaff, asyncHandler(inventoryController.lowStock));
// Receiving supplier stock (purchase-in) is warehouse manager / owner only.
inventoryRoutes.post('/receive', authMiddleware, requireWarehouse, asyncHandler(inventoryController.receive));
