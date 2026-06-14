import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole, requireStaff, requireOrderAdmin } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const reportRoutes = Router();

// Owner live views: revenue is owner-only; the (money-free) order-status view is order-admin.
reportRoutes.get('/monthly', authMiddleware, requireRole('OWNER'), asyncHandler(reportController.monthly));
reportRoutes.get('/order-status', authMiddleware, requireOrderAdmin, asyncHandler(reportController.orderStatus));

// Staff preview + send (persist) + their own history.
reportRoutes.get('/preview', authMiddleware, requireStaff, asyncHandler(reportController.preview));
reportRoutes.post('/send-owner', authMiddleware, requireStaff, asyncHandler(reportController.sendOwner));
reportRoutes.get('/mine', authMiddleware, requireStaff, asyncHandler(reportController.mine));

// Owner archive of received reports.
reportRoutes.get('/sent', authMiddleware, requireRole('OWNER'), asyncHandler(reportController.sent));
reportRoutes.get('/sent/:id', authMiddleware, requireRole('OWNER'), asyncHandler(reportController.sentDetail));
reportRoutes.delete('/sent/:id', authMiddleware, requireRole('OWNER'), asyncHandler(reportController.deleteSent));
