import { z } from 'zod';

export const initPaymentValidation = z.object({
    body: z.object({
        orderId: z.string().min(1, 'orderId is required'),
        method: z.enum(['bkash', 'sslcommerz', 'nagad', 'rocket', 'cod']),
    }),
});

export const bkashExecuteValidation = z.object({
    body: z.object({
        paymentID: z.string().min(1, 'paymentID is required'),
    }),
});

export const simulateConfirmValidation = z.object({
    body: z.object({
        transactionId: z.string().min(1, 'transactionId is required'),
        outcome: z.enum(['success', 'fail', 'cancel']),
    }),
});
