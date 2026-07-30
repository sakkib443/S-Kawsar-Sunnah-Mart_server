import { Review } from './review.model';
import AppError from '../../utils/AppError';
import QueryBuilder from '../../utils/QueryBuilder';

const ReviewService = {
    async getProductReviews(productId: string, query: Record<string, unknown>) {
        const reviewQuery = new QueryBuilder(
            Review.find({ product: productId, isApproved: true }).populate('user', 'firstName lastName avatar'),
            query
        ).sort().paginate();

        const reviews = await reviewQuery.modelQuery;
        const meta = await reviewQuery.countTotal();
        return { reviews, meta };
    },

    // Logged-in customer: their own review history (newest first)
    async getMyReviews(userId: string, query: Record<string, unknown>) {
        const reviewQuery = new QueryBuilder(
            Review.find({ user: userId }).populate('product', 'name thumbnail slug'),
            { sort: '-createdAt', ...query }
        ).sort().paginate();

        const reviews = await reviewQuery.modelQuery;
        const meta = await reviewQuery.countTotal();
        return { reviews, meta };
    },

    async createReview(userId: string, payload: any) {
        const exists = await Review.findOne({ product: payload.product, user: userId });
        if (exists) throw new AppError(400, 'You have already reviewed this product');
        const review = await Review.create({ ...payload, user: userId });

        // Let the admins know there is something new to moderate. Fire-and-forget.
        try {
            const { NotificationService } = require('../notification/notification.service');
            const { Product } = require('../product/product.model');
            Product.findById(payload.product).select('name').then((p: any) => {
                NotificationService.notifyAdmins({
                    type: 'new_review',
                    title: 'New product review',
                    message: `${review.rating}★ review left on "${p?.name || 'a product'}".`,
                    link: '/dashboard/admin/reviews',
                    meta: { reviewId: review._id.toString(), product: String(payload.product), rating: review.rating },
                }).catch(() => {});
            }).catch(() => {});
        } catch {
            // never block the review from being saved
        }

        return review;
    },

    // Public (guest) review — no login required. Post-save hook on Review model
    // keeps product.reviewCount / commentCount / rating in sync.
    async publicCreateReview(payload: any) {
        const { product, rating, comment, userName } = payload;
        return await Review.create({
            product,
            rating,
            comment,
            userName: userName?.trim() || 'Anonymous',
            user: null,
        });
    },

    async updateReview(id: string, userId: string, payload: any) {
        const review = await Review.findOneAndUpdate(
            { _id: id, user: userId },
            payload,
            { new: true }
        );
        if (!review) throw new AppError(404, 'Review not found');
        return review;
    },

    async deleteReview(id: string, userId: string, isAdmin: boolean) {
        const filter = isAdmin ? { _id: id } : { _id: id, user: userId };
        const review = await Review.findOneAndDelete(filter);
        if (!review) throw new AppError(404, 'Review not found');
        return review;
    },

    async getAllReviews(query: Record<string, unknown>) {
        const reviewQuery = new QueryBuilder(
            Review.find().populate('user', 'firstName lastName').populate('product', 'name thumbnail'),
            query
        ).sort().paginate();
        const reviews = await reviewQuery.modelQuery;
        const meta = await reviewQuery.countTotal();
        return { reviews, meta };
    },

    // Public: increment review like count
    async likeReview(reviewId: string) {
        const review = await Review.findByIdAndUpdate(
            reviewId,
            { $inc: { likes: 1 } },
            { new: true }
        );
        if (!review) throw new AppError(404, 'Review not found');
        return review;
    },

    // Public: add reply to a review
    async replyToReview(reviewId: string, payload: { text: string; userName?: string }) {
        const text = (payload.text || '').trim();
        if (!text) throw new AppError(400, 'Reply text is required');

        const review = await Review.findByIdAndUpdate(
            reviewId,
            {
                $push: {
                    replies: {
                        text,
                        userName: payload.userName?.trim() || 'Anonymous',
                        likes: 0,
                    },
                },
            },
            { new: true }
        );
        if (!review) throw new AppError(404, 'Review not found');
        return review;
    },

    // Public: like a specific reply inside a review
    async likeReply(reviewId: string, replyId: string) {
        const review = await Review.findOneAndUpdate(
            { _id: reviewId, 'replies._id': replyId },
            { $inc: { 'replies.$.likes': 1 } },
            { new: true }
        );
        if (!review) throw new AppError(404, 'Reply not found');
        return review;
    },

    // Admin: recompute reviewCount / commentCount / rating for every product — fixes drift from legacy data
    async resyncProductStats() {
        const { Product } = require('../product/product.model');
        const aggregated = await Review.aggregate([
            { $match: { isApproved: true } },
            {
                $group: {
                    _id: '$product',
                    count: { $sum: 1 },
                    avgRating: { $avg: '$rating' },
                },
            },
        ]);

        const statsByProduct = new Map<string, { count: number; rating: number }>();
        for (const row of aggregated) {
            statsByProduct.set(String(row._id), {
                count: row.count,
                rating: Math.round(row.avgRating * 10) / 10,
            });
        }

        const allProducts = await Product.find({}, '_id').lean();
        let updated = 0;
        for (const p of allProducts) {
            const s = statsByProduct.get(String(p._id)) || { count: 0, rating: 0 };
            await Product.findByIdAndUpdate(p._id, {
                reviewCount: s.count,
                commentCount: s.count,
                rating: s.rating,
            });
            updated++;
        }

        return { scanned: allProducts.length, updated };
    },
};

export default ReviewService;
