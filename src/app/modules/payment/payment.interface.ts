import { Types } from 'mongoose';

export type PaymentMethod = 'bkash' | 'sslcommerz' | 'nagad' | 'rocket' | 'cod';

// Gateway methods = everything except cash-on-delivery.
export type GatewayMethod = Exclude<PaymentMethod, 'cod'>;

export type TransactionStatus =
    | 'initiated'
    | 'pending'
    | 'success'
    | 'failed'
    | 'cancelled';

export interface ITransaction {
    order: Types.ObjectId;
    user?: Types.ObjectId | null;
    method: PaymentMethod;
    amount: number;
    status: TransactionStatus;
    gateway: string;
    gatewayTxnId: string;
    gatewayResponse?: unknown;
    createdAt?: Date;
    updatedAt?: Date;
}
