import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const userRoutes = Router();

// Staff provisioning is owner-only.
userRoutes.get('/', authMiddleware, requireRole('OWNER'), asyncHandler(userController.list));
userRoutes.post('/', authMiddleware, requireRole('OWNER'), asyncHandler(userController.create));
userRoutes.patch('/:id', authMiddleware, requireRole('OWNER'), asyncHandler(userController.update));
