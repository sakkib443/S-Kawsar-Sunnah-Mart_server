import express from 'express';
import ReviewController from './review.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { createReviewValidation, updateReviewValidation, publicCreateReviewValidation } from './review.validation';

const router = express.Router();

// Public routes (no auth)
router.get('/product/:productId', ReviewController.getProductReviews);
router.post('/public', validateRequest(publicCreateReviewValidation), ReviewController.publicCreate);
router.patch('/:reviewId/like', ReviewController.likeReview);
router.post('/:reviewId/reply', ReviewController.replyToReview);
router.patch('/:reviewId/replies/:replyId/like', ReviewController.likeReply);

// Auth-protected routes
router.get('/my', authMiddleware, ReviewController.getMine);
router.get('/', authMiddleware, authorizeRoles('admin'), ReviewController.getAll);
router.post('/admin/resync-product-stats', authMiddleware, authorizeRoles('admin'), ReviewController.resyncProductStats);
router.post('/', authMiddleware, validateRequest(createReviewValidation), ReviewController.create);
router.patch('/:id', authMiddleware, validateRequest(updateReviewValidation), ReviewController.update);
router.delete('/:id', authMiddleware, ReviewController.delete);

export const ReviewRoutes = router;
