import { z } from 'zod';

export const createCategoryValidation = z.object({
    body: z.object({
        name: z.string().min(1, 'Category name is required').max(100),
        slug: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        image: z.string().optional(),
        banner: z.string().optional(),
        parent: z.string().optional().nullable(),
        order: z.number().optional(),
        isActive: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        showInMenu: z.boolean().optional(),
        showInHome: z.boolean().optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
    }),
});

export const updateCategoryValidation = z.object({
    body: createCategoryValidation.shape.body.partial(),
});
