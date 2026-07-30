import { Schema, model } from 'mongoose';

const replySchema = new Schema(
    {
        text: { type: String, required: true, maxlength: 500 },
        userName: { type: String, maxlength: 50, default: 'Anonymous' },
        likes: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const reviewSchema = new Schema(
    {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        userName: { type: String, maxlength: 50, default: 'Anonymous' },
        rating: { type: Number, required: true, min: 1, max: 5 },
        title: { type: String, maxlength: 100, default: '' },
        comment: { type: String, required: true, maxlength: 1000 },
        images: [{ type: String }],
        isVerifiedPurchase: { type: Boolean, default: false },
        isApproved: { type: Boolean, default: true },
        helpfulVotes: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        replies: { type: [replySchema], default: [] },
    },
    { timestamps: true, toJSON: { virtuals: true } }
);

// Only enforce one-review-per-user for logged-in users (user != null)
reviewSchema.index(
    { product: 1, user: 1 },
    { unique: true, partialFilterExpression: { user: { $ne: null } } }
);
reviewSchema.index({ product: 1, isApproved: 1 });

// Auto-update product rating + review/comment count after save/delete — keeps both fields in sync
reviewSchema.post('save', async function () {
    const { Product } = require('../product/product.model');
    const stats = await (this.constructor as any).aggregate([
        { $match: { product: this.product, isApproved: true } },
        { $group: { _id: '$product', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const count = stats.length > 0 ? stats[0].count : 0;
    const rating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
    await Product.findByIdAndUpdate(this.product, {
        rating,
        reviewCount: count,
        commentCount: count,
    });
});

export const Review = model('Review', reviewSchema);
