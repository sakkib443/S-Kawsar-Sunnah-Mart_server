import { z } from 'zod';

export const updateUserValidation = z.object({
    body: z.object({
        firstName: z.string().min(1).max(50).optional(),
        lastName: z.string().min(1).max(50).optional(),
        phone: z.string().optional(),
        avatar: z.string().url().optional(),
    }),
});

export const addAddressValidation = z.object({
    body: z.object({
        label: z.string().default('Home'),
        fullName: z.string().min(1, 'Full name is required'),
        phone: z.string().min(1, 'Phone is required'),
        address: z.string().min(1, 'Address is required'),
        area: z.string().optional(),
        city: z.string().min(1, 'City is required'),
        postalCode: z.string().optional(),
        isDefault: z.boolean().default(false),
    }),
});

export const updateAddressValidation = z.object({
    body: z.object({
        label: z.string().optional(),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        area: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        isDefault: z.boolean().optional(),
    }),
});

export const updateStatusValidation = z.object({
    body: z.object({
        status: z.enum(['active', 'blocked', 'pending']),
    }),
});
