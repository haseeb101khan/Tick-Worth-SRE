import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const notificationRoutes = Router();

notificationRoutes.get('/', authMiddleware, asyncHandler(notificationController.listMine));
notificationRoutes.patch('/:id/read', authMiddleware, asyncHandler(notificationController.markRead));
