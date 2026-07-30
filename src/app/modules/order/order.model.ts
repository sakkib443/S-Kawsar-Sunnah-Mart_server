import { Schema, model } from 'mongoose';

const orderItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    thumbnail: { type: String, required: true },
    price: { type: Number, required: true },
    // Unit cost (buying price) snapshotted at purchase time — powers COGS / net-profit.
    // Kept internal; never surfaced to the customer.
    cost: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true },
    color: { type: String, default: '' },
    size: { type: String, default: '' },
}, { _id: true });

const timelineSchema = new Schema({
    status: { type: String },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });

const shippingAddressSchema = new Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, required: true },
    area: { type: String, default: '' },
    city: { type: String, default: '' },
    postalCode: { type: String, default: '' },
}, { _id: false });

const orderSchema = new Schema(
    {
        orderId: { type: String, unique: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        items: { type: [orderItemSchema], required: true },
        shippingAddress: { type: shippingAddressSchema, required: true },

        // Pricing
        subtotal: { type: Number, required: true },
        shippingCost: { type: Number, default: 0 },
        shippingFreeReason: { type: String, default: '' }, // '' | product | coupon | threshold | quantity
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true },
        couponCode: { type: String, default: '' },        // primary/first applied coupon (kept for display + back-compat)
        couponCodes: { type: [String], default: [] },     // all applied coupons when several are stacked on one order

        // Status
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'processing', 'shipped', 'on_the_way', 'out_for_delivery', 'delivery_attempt', 'delivered', 'cancelled', 'returned', 'refunded'],
            default: 'pending',
        },
        cancelReason: { type: String, default: '' },
        paymentMethod: {
            type: String,
            enum: ['cod', 'bkash', 'rocket', 'nagad', 'sslcommerz'],
            default: 'bkash',
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
        },
        transactionId: { type: String, default: '' },
        paymentDetails: {
            senderNumber: { type: String, default: '' },
            transactionId: { type: String, default: '' },
            paymentTime: { type: String, default: '' },
        },
        trackingNumber: { type: String, default: '' },
        carrier: { type: String, default: '' },
        consignmentId: { type: String, default: '' },   // Steadfast consignment id
        courierStatus: { type: String, default: '' },   // raw Steadfast delivery_status
        courierBookedAt: { type: Date },

        note: { type: String, default: '' },
        adminNote: { type: String, default: '' }, // internal note shown/editable on the admin order detail
        timeline: { type: [timelineSchema], default: [] },
    },
    { timestamps: true, toJSON: { virtuals: true } }
);

// Auto-generate order ID
orderSchema.pre('save', async function (next) {
    if (!this.orderId) {
        const count = await (this.constructor as any).countDocuments();
        this.orderId = `ABM-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = model('Order', orderSchema);
