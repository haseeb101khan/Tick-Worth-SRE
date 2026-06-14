import { Router } from 'express';
import * as damageController from '../controllers/damage.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireStaff } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const damageRoutes = Router();

damageRoutes.post('/', authMiddleware, requireStaff, asyncHandler(damageController.create));
damageRoutes.get('/', authMiddleware, requireStaff, asyncHandler(damageController.list));
damageRoutes.patch('/:id', authMiddleware, requireStaff, asyncHandler(damageController.update));
