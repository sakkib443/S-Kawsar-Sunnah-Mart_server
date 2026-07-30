import express from 'express';
import ReturnController from './return.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { createReturnValidation, rejectValidation } from './return.validation';

const router = express.Router();

// ── Customer routes ──────────────────────────────────────────────
router.post('/', authMiddleware, validateRequest(createReturnValidation), ReturnController.create);
router.get('/my', authMiddleware, ReturnController.getMyReturns);

// ── Admin routes ─────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, authorizeRoles('admin'), ReturnController.getAll);
router.patch('/admin/:id/approve', authMiddleware, authorizeRoles('admin'), ReturnController.adminApprove);
router.patch('/admin/:id/reject', authMiddleware, authorizeRoles('admin'), validateRequest(rejectValidation), ReturnController.adminReject);
router.patch('/admin/:id/refund', authMiddleware, authorizeRoles('admin'), ReturnController.adminRefund);

// ── Generic (must come after the specific paths above) ───────────
router.get('/:id', authMiddleware, ReturnController.getById);

export const ReturnRoutes = router;
