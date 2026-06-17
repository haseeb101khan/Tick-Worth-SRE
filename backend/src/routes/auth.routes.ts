import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const authRoutes = Router();

authRoutes.post('/register', asyncHandler(authController.register));
authRoutes.post('/login', asyncHandler(authController.login));
authRoutes.post('/verify', asyncHandler(authController.verifyEmail));
authRoutes.post('/resend-verification', asyncHandler(authController.resendVerification));
authRoutes.get('/me', authMiddleware, asyncHandler(authController.me));
