import express from 'express';
import OfferController from './offer.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { createOfferValidation, updateOfferValidation } from './offer.validation';

const router = express.Router();

// ── Public ──
router.get('/active', OfferController.getActive);

// ── Admin ──
router.get('/', authMiddleware, authorizeRoles('admin'), OfferController.getAll);
router.get('/:id', authMiddleware, authorizeRoles('admin'), OfferController.getById);
router.post('/', authMiddleware, authorizeRoles('admin'), validateRequest(createOfferValidation), OfferController.create);
router.patch('/:id', authMiddleware, authorizeRoles('admin'), validateRequest(updateOfferValidation), OfferController.update);
router.delete('/:id', authMiddleware, authorizeRoles('admin'), OfferController.delete);

export const OfferRoutes = router;
