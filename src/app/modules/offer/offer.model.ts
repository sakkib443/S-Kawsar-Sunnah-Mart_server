import { Schema, model } from 'mongoose';

/**
 * Offer / Flash-Sale — backend-managed promotional groupings shown on the
 * storefront (Flash Sale row, deal sections, promo banners). Admin creates
 * these; the frontend reads them. NOTHING about offers is hardcoded on the
 * client — the product set, the discount label and the countdown end time all
 * come from here.
 */
const offerSchema = new Schema(
    {
        title: { type: String, required: true, trim: true }, // e.g. "Flash Sale"
        subtitle: { type: String, default: '' }, // e.g. "UP TO 70% OFF"
        type: {
            type: String,
            enum: ['flash-sale', 'deal', 'banner'],
            default: 'flash-sale',
        },
        products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
        bannerImage: { type: String, default: '' }, // for type 'banner'
        link: { type: String, default: '' }, // optional CTA target
        startTime: { type: Date, default: () => new Date() },
        endTime: { type: Date, required: true }, // countdown target
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

offerSchema.index({ isActive: 1, type: 1, startTime: 1, endTime: 1 });

export const Offer = model('Offer', offerSchema);
