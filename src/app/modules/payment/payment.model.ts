import { Schema, model } from 'mongoose';
import { ITransaction } from './payment.interface';

/**
 * Transaction = the payment LOG / history source.
 * One order can have multiple transactions over its lifetime
 * (e.g. an initial attempt that fails, then a retry that succeeds).
 */
const transactionSchema = new Schema<ITransaction>(
    {
        order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
        // optional: guest checkouts have no user
        user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        method: {
            type: String,
            enum: ['bkash', 'sslcommerz', 'nagad', 'rocket', 'cod'],
            required: true,
        },
        amount: { type: Number, required: true },
        status: {
            type: String,
            enum: ['initiated', 'pending', 'success', 'failed', 'cancelled'],
            default: 'initiated',
        },
        gateway: { type: String, default: '' },          // 'sslcommerz' | 'bkash' | 'dev-simulation'
        gatewayTxnId: { type: String, default: '' },     // tran_id / paymentID / val_id
        gatewayResponse: { type: Schema.Types.Mixed, default: null },
    },
    { timestamps: true }
);

transactionSchema.index({ order: 1, createdAt: -1 });
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ gatewayTxnId: 1 });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
