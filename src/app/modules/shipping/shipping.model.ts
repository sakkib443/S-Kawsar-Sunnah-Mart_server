import mongoose, { Schema, Document } from 'mongoose';

// ── Shipping Zone ──────────────────────────────────
export interface IShippingZone extends Document {
    name: string;
    regions: string[];
    isActive: boolean;
}

const shippingZoneSchema = new Schema<IShippingZone>({
    name: { type: String, required: true },
    regions: [{ type: String }],
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const ShippingZone = mongoose.model<IShippingZone>('ShippingZone', shippingZoneSchema);

// ── Shipping Rate ──────────────────────────────────
export interface IShippingRate extends Document {
    name: string;
    zone: mongoose.Types.ObjectId;
    minWeight: number;
    maxWeight: number;
    price: number;
    // Order subtotal at/above which this zone's shipping is free (0 = disabled).
    freeShippingMinimum: number;
    estimatedDays: string;
    isActive: boolean;
}

const shippingRateSchema = new Schema<IShippingRate>({
    name: { type: String, required: true },
    zone: { type: Schema.Types.ObjectId, ref: 'ShippingZone' },
    minWeight: { type: Number, default: 0 },
    maxWeight: { type: Number, default: 999 },
    price: { type: Number, required: true },
    freeShippingMinimum: { type: Number, default: 0 },
    estimatedDays: { type: String, default: '3-5 days' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const ShippingRate = mongoose.model<IShippingRate>('ShippingRate', shippingRateSchema);

// ── Shipping Settings (singleton — admin-tunable global rules) ──────
export interface IShippingSettings extends Document {
    _key: string;
    freeShippingThreshold: number;
    freeShippingByThresholdEnabled: boolean;
    defaultInsideDhakaRate: number;
    defaultOutsideDhakaRate: number;
    defaultEstimatedDays: string;
    quantityFreeShippingEnabled: boolean;
    minItemsForFreeShipping: number;
    // Platform commission fallback (%) used when a product's category tree has no rate set.
    defaultCommissionRate: number;
}

const shippingSettingsSchema = new Schema<IShippingSettings>({
    _key: { type: String, default: 'main', unique: true },
    freeShippingThreshold: { type: Number, default: 5000 },
    freeShippingByThresholdEnabled: { type: Boolean, default: true },
    defaultInsideDhakaRate: { type: Number, default: 60 },
    defaultOutsideDhakaRate: { type: Number, default: 120 },
    defaultEstimatedDays: { type: String, default: '3-5 days' },
    quantityFreeShippingEnabled: { type: Boolean, default: false },
    minItemsForFreeShipping: { type: Number, default: 0 },
    defaultCommissionRate: { type: Number, default: 10, min: 0, max: 100 },
}, { timestamps: true });

export const ShippingSettings = mongoose.model<IShippingSettings>('ShippingSettings', shippingSettingsSchema);
