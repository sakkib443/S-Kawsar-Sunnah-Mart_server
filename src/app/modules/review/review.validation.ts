import { z } from 'zod';

export const createReviewValidation = z.object({
    body: z.object({
        product: z.string().min(1, 'Product ID required'),
        rating: z.number().min(1).max(5),
        title: z.string().max(100).optional(),
        comment: z.string().min(1, 'Comment is required').max(1000),
        images: z.array(z.string()).optional(),
        userName: z.string().max(50).optional(),
    }),
});

// Public (guest) review — no login required, userName accepted
export const publicCreateReviewValidation = z.object({
    body: z.object({
        product: z.string().min(1, 'Product ID required'),
        rating: z.number().min(1).max(5),
        comment: z.string().min(1, 'Comment is required').max(1000),
        userName: z.string().max(50).optional(),
    }),
});

export const updateReviewValidation = z.object({
    body: z.object({
        rating: z.number().min(1).max(5).optional(),
        title: z.string().max(100).optional(),
        comment: z.string().max(1000).optional(),
    }),
});
