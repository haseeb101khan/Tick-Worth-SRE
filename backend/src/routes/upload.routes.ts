import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireStaff } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

// The larger JSON body limit (for the data-URL image) is applied where this router is mounted
// in app.ts, before the global json parser.
export const uploadRoutes = Router();

uploadRoutes.post('/image', authMiddleware, requireStaff, asyncHandler(uploadController.image));
// Customers upload their own EasyPaisa payment screenshot at checkout.
uploadRoutes.post('/payment-proof', authMiddleware, asyncHandler(uploadController.paymentProof));
