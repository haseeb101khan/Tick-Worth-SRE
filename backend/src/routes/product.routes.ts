import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import * as reviewController from '../controllers/review.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireStaff, requireRole } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const productRoutes = Router();

// Public catalog
productRoutes.get('/', asyncHandler(productController.list));
// Staff-only: retired products list — declared BEFORE '/:id' so it isn't read as an id.
productRoutes.get('/archived', authMiddleware, requireStaff, asyncHandler(productController.listArchived));
productRoutes.get('/:id', asyncHandler(productController.getOne));

// Reviews (nested under the product resource)
productRoutes.get('/:id/reviews', asyncHandler(reviewController.list)); // public
productRoutes.get('/:id/reviews/me', authMiddleware, requireRole('CUSTOMER'), asyncHandler(reviewController.myState));
productRoutes.post('/:id/reviews', authMiddleware, requireRole('CUSTOMER'), asyncHandler(reviewController.create));

// Staff-only management
productRoutes.post('/', authMiddleware, requireStaff, asyncHandler(productController.create));
productRoutes.patch('/:id', authMiddleware, requireStaff, asyncHandler(productController.update));
productRoutes.put('/:id/variants', authMiddleware, requireStaff, asyncHandler(productController.setVariants));
productRoutes.post('/:id/restore', authMiddleware, requireStaff, asyncHandler(productController.restore));
productRoutes.delete('/:id', authMiddleware, requireStaff, asyncHandler(productController.remove));
