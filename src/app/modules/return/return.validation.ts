import { z } from 'zod';

const returnItemValidation = z.object({
    product: z.string().min(1, 'Product ID required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
});

export const createReturnValidation = z.object({
    body: z.object({
        orderId: z.string().min(1, 'Order ID required'),
        items: z.array(returnItemValidation).min(1, 'At least one item required'),
        reason: z.enum(['defective', 'wrong_item', 'not_as_described', 'damaged', 'changed_mind', 'other']),
        description: z.string().optional(),
        images: z.array(z.string()).optional(),
    }),
});

export const rejectValidation = z.object({
    body: z.object({
        rejectionReason: z.string().min(1, 'Rejection reason required'),
    }),
});
