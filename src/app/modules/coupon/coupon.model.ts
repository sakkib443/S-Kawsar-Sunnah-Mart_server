import { Schema, model } from 'mongoose';

const couponSchema = new Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        description: { type: String, default: '' },
        discountType: { type: String, enum: ['percentage', 'fixed', 'free_shipping'], default: 'percentage' },
        discountValue: { type: Number, required: true, min: 0, default: 0 },
        maxDiscount: { type: Number, default: null }, // max taka for percentage
        minOrderAmount: { type: Number, default: 0 },
        usageLimit: { type: Number, default: null }, // null = unlimited
        usedCount: { type: Number, default: 0 },
        expiresAt: { type: Date, required: true },
        isActive: { type: Boolean, default: true },

        // ── Scope: which products the coupon discount applies to ──
        // 'all'                → whole order (default)
        // 'specific_products'  → only items whose product is in `specificProducts`
        // 'specific_categories'→ only items whose category is in `specificCategories`
        applicableTo: { type: String, enum: ['all', 'specific_products', 'specific_categories'], default: 'all' },
        specificProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
        specificCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    },
    { timestamps: true }
);

couponSchema.index({ isActive: 1, expiresAt: 1 });

export const Coupon = model('Coupon', couponSchema);
