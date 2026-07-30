import { z } from 'zod';

export const createOfferValidation = z.object({
    body: z.object({
        title: z.string().min(1).max(60),
        subtitle: z.string().max(80).optional(),
        type: z.enum(['flash-sale', 'deal', 'banner']).default('flash-sale'),
        products: z.array(z.string()).optional(),
        bannerImage: z.string().optional(),
        link: z.string().optional(),
        startTime: z.string().or(z.date()).optional(),
        endTime: z.string().or(z.date()),
        isActive: z.boolean().default(true),
        sortOrder: z.number().optional(),
    }),
});

export const updateOfferValidation = z.object({
    body: z.object({
        title: z.string().min(1).max(60).optional(),
        subtitle: z.string().max(80).optional(),
        type: z.enum(['flash-sale', 'deal', 'banner']).optional(),
        products: z.array(z.string()).optional(),
        bannerImage: z.string().optional(),
        link: z.string().optional(),
        startTime: z.string().or(z.date()).optional(),
        endTime: z.string().or(z.date()).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
    }),
});
