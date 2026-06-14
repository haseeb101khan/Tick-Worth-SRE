import { Router } from 'express';
import * as restockRequestController from '../controllers/restockRequest.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireStaff, requireOrderAdmin, requireWarehouse } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const restockRequestRoutes = Router();

// Shopkeeper/owner raise restock asks and withdraw their own open ones.
restockRequestRoutes.post('/', authMiddleware, requireOrderAdmin, asyncHandler(restockRequestController.create));
restockRequestRoutes.post('/:id/cancel', authMiddleware, requireOrderAdmin, asyncHandler(restockRequestController.cancel));

// Any staff can see the queue (shop tracks its asks; warehouse acts on them).
restockRequestRoutes.get('/', authMiddleware, requireStaff, asyncHandler(restockRequestController.list));

// Only those who can move stock OUT of the warehouse may fulfil/decline.
restockRequestRoutes.patch('/:id', authMiddleware, requireWarehouse, asyncHandler(restockRequestController.resolve));
