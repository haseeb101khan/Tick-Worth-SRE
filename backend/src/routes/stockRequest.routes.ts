import { Router } from 'express';
import * as stockRequestController from '../controllers/stockRequest.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole, requireOrderAdmin } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const stockRequestRoutes = Router();

// Customers raise + track + cancel their own requests.
stockRequestRoutes.post('/', authMiddleware, requireRole('CUSTOMER'), asyncHandler(stockRequestController.create));
stockRequestRoutes.get('/my', authMiddleware, requireRole('CUSTOMER'), asyncHandler(stockRequestController.myRequests));
stockRequestRoutes.post('/:id/cancel', authMiddleware, requireRole('CUSTOMER'), asyncHandler(stockRequestController.cancel));

// Order admins (shopkeeper / owner) see the demand queue and resolve it.
stockRequestRoutes.get('/', authMiddleware, requireOrderAdmin, asyncHandler(stockRequestController.allRequests));
stockRequestRoutes.patch('/:id', authMiddleware, requireOrderAdmin, asyncHandler(stockRequestController.resolve));
