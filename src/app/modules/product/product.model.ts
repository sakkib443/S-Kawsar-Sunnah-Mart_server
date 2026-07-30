import { Schema, model } from 'mongoose';

// ── Variant Schema ─────────────────────────────────────────
// One variant = one combination of color + size with its own price/stock/images
const variantSchema = new Schema(
    {
        label:         { type: String, default: '' },       // e.g. "Red / XL" — auto-generated or manual
        color:         { type: String, default: '' },       // e.g. "Red"
        colorHex:      { type: String, default: '' },       // e.g. "#FF0000"
        size:          { type: String, default: '' },       // e.g. "S", "M", "XL", "1kg"
        description:   { type: String, default: '' },       // variant-specific description (defaults to product description)
        price:         { type: Number, required: true, min: 0 },
        originalPrice: { type: Number, default: null },
        discount:      { type: Number, default: 0, min: 0, max: 100 }, // auto-calculated
        stock:         { type: Number, default: 0 },
        sku:           { type: String, default: '' },       // variant-specific SKU
        images:        [{ type: String }],                  // variant-specific images (shown when selected)
        note:          { type: String, default: '' },       // short variant description / extra info
    },
    { _id: true }
);

const productSchema = new Schema(
    {
        // ── Basic Info ──────────────────────────────────────────
        name:        { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 200 },
        slug:        { type: String, unique: true, lowercase: true },
        sku:         { type: String, unique: true, sparse: true },
        description: { type: String, required: [true, 'Description is required'] },
        tagline:     { type: String, maxlength: 200, default: 'Lower price than others but quality higher' },
        priceType:   { type: String, enum: ['fixed', 'negotiable'], default: 'negotiable' },
        productType: { type: String, enum: ['simple', 'variable', 'multi-color'], default: 'simple' },

        // ── Pricing ─────────────────────────────────────────────
        price:         { type: Number, required: [true, 'Price is required'], min: 0 },
        originalPrice: { type: Number, default: null },
        discount:      { type: Number, default: 0, min: 0, max: 100 }, // auto-calculated from originalPrice vs price
        costPrice:     { type: Number, default: 0, min: 0 }, // internal cost (never shown publicly)

        // ── Offer validity window ───────────────────────────────
        offerStartDate: { type: Date, default: null },
        offerEndDate:   { type: Date, default: null },

        // ── Images ──────────────────────────────────────────────
        thumbnail: { type: String, required: [true, 'Thumbnail is required'] },
        images:    [{ type: String }],

        // ── Category ─────────────────────────────────────────────
        category:    { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        subCategory: { type: Schema.Types.ObjectId, ref: 'Category', default: null },

        // ── Specifications ───────────────────────────────────────
        brand:        { type: String, default: '' },
        model:        { type: String, default: '' },
        weight:       { type: String, default: '' }, // allow units, e.g. '500 g'
        boxSize:      { type: String, default: '' },
        insideTheBox: { type: String, default: '' },
        compatibility:{ type: String, default: '' }, // which models / products this item is compatible with
        material:     { type: [String], default: [] },
        pattern:      { type: String, default: '' },
        gender:       { type: String, enum: ['', 'Men', 'Women', 'Unisex', 'Kids'], default: '' },

        // ── Key-value spec table (Daraz "Specifications") + bullet highlights ──
        specifications: { type: [{ key: { type: String, default: '' }, value: { type: String, default: '' } }], default: [] },
        highlights:     { type: [String], default: [] },

        // ── Physical dimensions (cm — used for shipping estimates) ──
        dimensions: {
            length: { type: Number, default: 0 },
            width:  { type: Number, default: 0 },
            height: { type: Number, default: 0 },
        },

        // ── Warranty ──────────────────────────────────────────────
        warranty: {
            hasWarranty:  { type: Boolean, default: false },
            duration:     { type: Number, default: 0 },
            durationUnit: { type: String, enum: ['days', 'months', 'years'], default: 'months' },
            type:         { type: String, enum: ['manufacturer', 'seller', 'none'], default: 'manufacturer' },
        },

        // ── Per-product shipping config ───────────────────────────
        shippingConfig: {
            freeShipping:  { type: Boolean, default: false },
            shippingCost:  { type: Number, default: 0 },
            estimatedDays: { type: Number, default: 3 },
        },

        // ── Payment / courier hook ────────────────────────────────
        codAvailable: { type: Boolean, default: true }, // Cash on Delivery available for this product

        // ── Variants ──────────────────────────────────────────────
        // Each variant = unique color+size combo with its own price, stock, images
        variants: { type: [variantSchema], default: [] },

        // ── Base Stock (used when no variants exist) ───────────────
        stock: { type: Number, default: 0 },
        lowStockThreshold: { type: Number, default: 5 },
        unit: { type: String, default: 'piece' }, // piece / kg / liter / pack / pair / box / dozen

        // ── Status / Visibility ───────────────────────────────────
        status: {
            type: String,
            enum: { values: ['active', 'draft', 'out-of-stock'], message: '{VALUE} is not valid' },
            default: 'active',
        },
        visibility: {
            type: String,
            enum: { values: ['visible', 'hidden'], message: '{VALUE} is not valid' },
            default: 'visible',
        },
        isDeleted: { type: Boolean, default: false },

        // ── Merchandising flags ───────────────────────────────────
        isFeatured:   { type: Boolean, default: false },
        isNewProduct: { type: Boolean, default: true },
        isOnSale:     { type: Boolean, default: false },
        // Admin-picked "Top Selling Products" row. Manual on purpose: a new shop has
        // no sales history yet, so totalSold alone cannot decide what to showcase.
        isBestSelling: { type: Boolean, default: false },

        // ── Image Search / Filter Fields ─────────────────────────
        tags:      { type: [String], default: [] },
        colors:    { type: [String], default: [] },
        colorHex:  { type: [String], default: [] },
        sizes:     { type: [String], default: [] },
        aiLabels:  { type: [String], default: [] },

        // ── Content Tabs (Product Page) ──────────────────────────
        deliveryInfo: { type: String, default: '' },
        paymentInfo:  { type: String, default: '' },
        termsInfo:    { type: String, default: '' },

        // ── SEO ───────────────────────────────────────────────────
        metaTitle:       { type: String, default: '' },
        metaDescription: { type: String, default: '' },
        metaKeywords:    { type: [String], default: [] },

        // ── Stats ─────────────────────────────────────────────────
        rating:        { type: Number, default: 0, min: 0, max: 5 },
        reviewCount:   { type: Number, default: 0 },
        totalSold:     { type: Number, default: 0 },
        viewCount:     { type: Number, default: 0 },
        likeCount:     { type: Number, default: 0 },
        commentCount:  { type: Number, default: 0 },
        shareCount:    { type: Number, default: 0 },
        wishlistCount: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
    }
);

// ── Indexes ────────────────────────────────────────────────
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isFeatured: 1, isOnSale: 1 });
productSchema.index({ rating: -1, totalSold: -1 });
productSchema.index({ tags: 1 });
productSchema.index({ colors: 1 });
productSchema.index({ isDeleted: 1, status: 1 });

// ── Virtual: discountedPrice ───────────────────────────────
productSchema.virtual('discountedPrice').get(function () {
    if (this.discount > 0) {
        return this.price - (this.price * this.discount) / 100;
    }
    return this.price;
});

// ── Virtual: soldCount (alias) ─────────────────────────────
productSchema.virtual('soldCount').get(function () {
    return this.totalSold || 0;
});

// ── Pre-save hooks ─────────────────────────────────────────
productSchema.pre('save', function (next) {
    // Auto slug
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    }

    // Auto SKU
    if (!this.sku) {
        this.sku = 'SKU-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    // Auto-calculate base product discount %
    if (this.originalPrice && this.originalPrice > this.price) {
        this.discount = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
    } else {
        this.discount = 0;
    }

    // Auto-calculate each variant's discount % + auto-label
    if (this.variants && this.variants.length > 0) {
        this.variants.forEach((variant: any) => {
            // Auto discount
            if (variant.originalPrice && variant.originalPrice > variant.price) {
                variant.discount = Math.round(((variant.originalPrice - variant.price) / variant.originalPrice) * 100);
            } else {
                variant.discount = 0;
            }
            // Auto label: "Red / XL" or "Red" or "XL"
            if (!variant.label) {
                const parts = [variant.color, variant.size].filter(Boolean);
                variant.label = parts.join(' / ');
            }
        });
    }

    next();
});

// ── Pre-find: Exclude deleted ──────────────────────────────
productSchema.pre('find', function (next) {
    if (!(this.getFilter() as any).isDeleted) {
        this.find({ isDeleted: { $ne: true } });
    }
    next();
});

export const Product = model('Product', productSchema);
