import { z } from 'zod';

export const createCouponValidation = z.object({
    body: z.object({
        code: z.string().min(1).max(20),
        description: z.string().optional(),
        discountType: z.enum(['percentage', 'fixed', 'free_shipping']).default('percentage'),
        discountValue: z.number().min(0).optional().default(0),
        maxDiscount: z.number().nullable().optional(),
        minOrderAmount: z.number().min(0).default(0),
        usageLimit: z.number().optional(),
        expiresAt: z.string().or(z.date()),
        isActive: z.boolean().default(true),
        applicableTo: z.enum(['all', 'specific_products', 'specific_categories']).optional().default('all'),
        specificProducts: z.array(z.string()).optional().default([]),
        specificCategories: z.array(z.string()).optional().default([]),
    }),
});

export const validateCouponValidation = z.object({
    body: z.object({
        code: z.string().min(1, 'Coupon code is required'),
        // orderAmount is kept for the min-order check; items enable product/category scoping.
        orderAmount: z.number().min(0).optional(),
        items: z.array(z.object({
            product: z.string().min(1),
            price: z.number().min(0),
            quantity: z.number().min(1),
        })).optional(),
    }),
});
