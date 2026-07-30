import { Coupon } from './coupon.model';
import { Product } from '../product/product.model';
import AppError from '../../utils/AppError';

// ── Coupon scope / discount helpers (shared with order.service) ──────────────

export interface CouponLineItem {
    productId: string;
    categoryId?: string | null;
    lineTotal: number; // unit price × quantity
}

// Sum of the line totals a coupon actually covers, based on its scope.
//   'all'                 → the whole order
//   'specific_products'   → only items whose product is in specificProducts
//   'specific_categories' → only items whose category is in specificCategories
export const getEligibleAmount = (coupon: any, items: CouponLineItem[]): number => {
    if (coupon.applicableTo === 'specific_products') {
        const set = new Set((coupon.specificProducts || []).map((p: any) => String(p)));
        return items.filter((i) => set.has(String(i.productId))).reduce((s, i) => s + i.lineTotal, 0);
    }
    if (coupon.applicableTo === 'specific_categories') {
        const set = new Set((coupon.specificCategories || []).map((c: any) => String(c)));
        return items.filter((i) => i.categoryId && set.has(String(i.categoryId))).reduce((s, i) => s + i.lineTotal, 0);
    }
    return items.reduce((s, i) => s + i.lineTotal, 0);
};

// Discount for a given eligible amount. Never exceeds the eligible amount;
// percentage coupons respect maxDiscount. free_shipping yields no price discount.
export const computeCouponDiscount = (coupon: any, eligibleAmount: number): number => {
    if (coupon.discountType === 'free_shipping') return 0;
    let discount = coupon.discountType === 'percentage'
        ? (eligibleAmount * coupon.discountValue) / 100
        : coupon.discountValue;
    if (coupon.discountType === 'percentage' && coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
    }
    return Math.min(discount, eligibleAmount);
};

// ─────────────────────────────────────────────────────────────────────────────

const CouponService = {
    async getAll() {
        return await Coupon.find().sort({ createdAt: -1 });
    },

    async validate(
        code: string,
        opts: { orderAmount?: number; items?: { product: string; price: number; quantity: number }[] } = {},
    ) {
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
        if (!coupon) throw new AppError(404, 'Invalid coupon code');
        if (coupon.expiresAt < new Date()) throw new AppError(400, 'Coupon has expired');
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError(400, 'Coupon usage limit reached');

        const rawItems = opts.items || [];

        // Build line items; look up each product's category only when the coupon
        // is category-scoped (avoids an extra query otherwise).
        let lineItems: CouponLineItem[] = [];
        if (rawItems.length > 0) {
            let catMap = new Map<string, string>();
            if (coupon.applicableTo === 'specific_categories') {
                const products = await Product.find({ _id: { $in: rawItems.map((i) => i.product) } }).select('category');
                catMap = new Map(products.map((p: any) => [String(p._id), String(p.category)]));
            }
            lineItems = rawItems.map((i) => ({
                productId: i.product,
                categoryId: catMap.get(String(i.product)) || null,
                lineTotal: (i.price || 0) * (i.quantity || 0),
            }));
        }

        const orderAmount = typeof opts.orderAmount === 'number'
            ? opts.orderAmount
            : lineItems.reduce((s, i) => s + i.lineTotal, 0);

        if (orderAmount < coupon.minOrderAmount) {
            throw new AppError(400, `Minimum order amount is ৳${coupon.minOrderAmount}`);
        }

        // Eligible amount = whole order for 'all', else only the matching items.
        // If items weren't supplied we can't scope, so fall back to the full order.
        const eligibleAmount = lineItems.length > 0 ? getEligibleAmount(coupon, lineItems) : orderAmount;
        if (coupon.applicableTo !== 'all' && lineItems.length > 0 && eligibleAmount <= 0) {
            throw new AppError(400, 'This coupon does not apply to the selected items');
        }

        const freeShipping = coupon.discountType === 'free_shipping';
        const discount = computeCouponDiscount(coupon, eligibleAmount);

        return { coupon, discount, freeShipping, eligibleAmount };
    },

    async create(payload: any) {
        payload.code = payload.code.toUpperCase();
        const exists = await Coupon.findOne({ code: payload.code });
        if (exists) throw new AppError(400, 'Coupon code already exists');
        return await Coupon.create(payload);
    },

    async update(id: string, payload: any) {
        const coupon = await Coupon.findByIdAndUpdate(id, payload, { new: true });
        if (!coupon) throw new AppError(404, 'Coupon not found');
        return coupon;
    },

    async delete(id: string) {
        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) throw new AppError(404, 'Coupon not found');
        return coupon;
    },
};

export default CouponService;
