import { Router } from 'express';
import * as transferController from '../controllers/transfer.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireStaff } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const transferRoutes = Router();

// Staff only; warehouse-sourced transfers are further restricted in the controller.
transferRoutes.post('/', authMiddleware, requireStaff, asyncHandler(transferController.create));
