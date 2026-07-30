import { Schema, model } from 'mongoose';

const inquirySchema = new Schema(
    {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true, maxlength: 100, trim: true },
        phone: { type: String, required: true, maxlength: 100, trim: true }, // phone or email
        message: { type: String, required: true, maxlength: 2000, trim: true },
        status: { type: String, enum: ['pending', 'replied', 'closed'], default: 'pending' },
        adminReply: { type: String, default: '' },
    },
    { timestamps: true, toJSON: { virtuals: true } }
);

inquirySchema.index({ product: 1, createdAt: -1 });
inquirySchema.index({ status: 1 });

export const Inquiry = model('Inquiry', inquirySchema);
