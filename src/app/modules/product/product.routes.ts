import express from 'express';
import ProductController from './product.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { createProductValidation, updateProductValidation, bulkStatusValidation, bulkDeleteValidation, bulkUploadValidation } from './product.validation';

const router = express.Router();

// ── Public routes ───────────────────────────────────────────────
router.get('/', ProductController.getAll);
router.get('/featured', ProductController.getFeatured);
// Live search + brand facets — MUST be before the generic '/:id' route.
router.get('/suggest', ProductController.suggest);
router.get('/brands', ProductController.getBrands);
router.get('/slug/:slug', ProductController.getBySlug);
router.patch('/:id/stat', ProductController.incrementStat);
router.get('/:id/related/:categoryId', ProductController.getRelated);
router.get('/:id', ProductController.getById);

// ── Admin routes ────────────────────────────────────────────────
router.get('/admin/stats', authMiddleware, authorizeRoles('admin'), ProductController.getStats);
router.get('/admin/low-stock', authMiddleware, authorizeRoles('admin'), ProductController.getLowStock);
router.post('/admin/bulk-upload', authMiddleware, authorizeRoles('admin'), validateRequest(bulkUploadValidation), ProductController.bulkUpload);
router.post('/', authMiddleware, authorizeRoles('admin'), validateRequest(createProductValidation), ProductController.create);
router.patch('/admin/bulk-status', authMiddleware, authorizeRoles('admin'), validateRequest(bulkStatusValidation), ProductController.bulkUpdateStatus);
router.delete('/admin/bulk-delete', authMiddleware, authorizeRoles('admin'), validateRequest(bulkDeleteValidation), ProductController.bulkDelete);
router.patch('/:id', authMiddleware, authorizeRoles('admin'), validateRequest(updateProductValidation), ProductController.update);
router.delete('/:id', authMiddleware, authorizeRoles('admin'), ProductController.delete);

export const ProductRoutes = router;
