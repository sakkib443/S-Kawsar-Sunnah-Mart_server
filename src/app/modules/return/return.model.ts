import { Schema, model } from 'mongoose';

const returnItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    thumbnail: { type: String, default: '' },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const timelineSchema = new Schema({
    status: { type: String },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });

const returnRequestSchema = new Schema(
    {
        returnId: { type: String, unique: true },
        order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
        orderId: { type: String, default: '' },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        items: { type: [returnItemSchema], required: true },
        reason: {
            type: String,
            enum: ['defective', 'wrong_item', 'not_as_described', 'damaged', 'changed_mind', 'other'],
            required: true,
        },
        description: { type: String, default: '' },
        images: { type: [String], default: [] },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'refunded'],
            default: 'pending',
        },
        refundAmount: { type: Number, default: 0 },
        rejectionReason: { type: String, default: '' },
        resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        resolvedAt: { type: Date, default: null },
        timeline: { type: [timelineSchema], default: [] },
    },
    { timestamps: true }
);

// Auto-generate return ID (RET-XXXX)
returnRequestSchema.pre('save', async function (next) {
    if (!this.returnId) {
        const count = await (this.constructor as any).countDocuments();
        this.returnId = `RET-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

returnRequestSchema.index({ user: 1, status: 1 });

export const ReturnRequest = model('ReturnRequest', returnRequestSchema);
