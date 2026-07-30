import express from 'express';
import CouponController from './coupon.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { createCouponValidation, validateCouponValidation } from './coupon.validation';

const router = express.Router();

router.post('/validate', authMiddleware, validateRequest(validateCouponValidation), CouponController.validate);
router.get('/', authMiddleware, authorizeRoles('admin'), CouponController.getAll);
router.post('/', authMiddleware, authorizeRoles('admin'), validateRequest(createCouponValidation), CouponController.create);
router.patch('/:id', authMiddleware, authorizeRoles('admin'), CouponController.update);
router.delete('/:id', authMiddleware, authorizeRoles('admin'), CouponController.delete);

export const CouponRoutes = router;
