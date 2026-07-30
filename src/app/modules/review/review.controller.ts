import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import ReviewService from './review.service';

const ReviewController = {
    getProductReviews: catchAsync(async (req: Request, res: Response) => {
        const { reviews, meta } = await ReviewService.getProductReviews(req.params.productId, req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'Reviews fetched', data: reviews, meta });
    }),
    getAll: catchAsync(async (req: Request, res: Response) => {
        const { reviews, meta } = await ReviewService.getAllReviews(req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'All reviews fetched', data: reviews, meta });
    }),
    getMine: catchAsync(async (req: Request, res: Response) => {
        const { reviews, meta } = await ReviewService.getMyReviews(req.user!.userId, req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'My reviews fetched', data: reviews, meta });
    }),
    create: catchAsync(async (req: Request, res: Response) => {
        const review = await ReviewService.createReview(req.user!.userId, req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Review submitted', data: review });
    }),
    publicCreate: catchAsync(async (req: Request, res: Response) => {
        const review = await ReviewService.publicCreateReview(req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Comment submitted', data: review });
    }),
    update: catchAsync(async (req: Request, res: Response) => {
        const review = await ReviewService.updateReview(req.params.id, req.user!.userId, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Review updated', data: review });
    }),
    delete: catchAsync(async (req: Request, res: Response) => {
        await ReviewService.deleteReview(req.params.id, req.user!.userId, req.user!.role === 'admin');
        sendResponse(res, { statusCode: 200, success: true, message: 'Review deleted' });
    }),
    likeReview: catchAsync(async (req: Request, res: Response) => {
        const review = await ReviewService.likeReview(req.params.reviewId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Review liked', data: review });
    }),
    replyToReview: catchAsync(async (req: Request, res: Response) => {
        const review = await ReviewService.replyToReview(req.params.reviewId, req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Reply added', data: review });
    }),
    likeReply: catchAsync(async (req: Request, res: Response) => {
        const review = await ReviewService.likeReply(req.params.reviewId, req.params.replyId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Reply liked', data: review });
    }),
    resyncProductStats: catchAsync(async (_req: Request, res: Response) => {
        const result = await ReviewService.resyncProductStats();
        sendResponse(res, { statusCode: 200, success: true, message: 'Product stats resynced', data: result });
    }),
};

export default ReviewController;
