import { z } from 'zod';

// ── Shared product create shape (reused by single create + bulk upload) ──
// Defined as a bare object schema (no { body } wrapper) so it can be:
//   1) wrapped in { body } + .refine for the single-create request, and
//   2) nested inside the bulk-upload products[] array.
const productCreateShape = z.object({
    name:          z.string({ required_error: 'Product name is required', invalid_type_error: 'Product name is required' }).min(1, 'Product name is required').max(200),
    description:   z.string({ required_error: 'Description is required', invalid_type_error: 'Description is required' }).min(1, 'Description is required'),
    tagline:       z.string().max(200).optional(),
    priceType:     z.enum(['fixed', 'negotiable']).optional(),
    productType:   z.enum(['simple', 'variable', 'multi-color']).optional(),
    slug:          z.string().optional(),

    // Pricing — discount is auto-calculated, no need to send it
    price:         z.number({ required_error: 'Price is required', invalid_type_error: 'Price must be a number' }).min(0, 'Price must be positive'),
    originalPrice: z.number().min(0).optional().nullable(),
    costPrice:     z.number().min(0).optional(),

    // Offer validity window — ISO date string or null; flows through create + update
    offerStartDate: z.string().or(z.date()).optional().nullable(),
    offerEndDate:   z.string().or(z.date()).optional().nullable(),

    // Images
    thumbnail: z.string({ required_error: 'Thumbnail is required', invalid_type_error: 'Thumbnail is required' }).min(1, 'Thumbnail is required'),
    images:    z.array(z.string()).optional(),

    // Category
    category:    z.string({ required_error: 'Category is required', invalid_type_error: 'Category is required' }).min(1, 'Category is required'),
    subCategory: z.string().optional(),

    // Specifications
    brand:        z.string().optional(),
    model:        z.string().optional(),
    weight:       z.string().optional(),
    boxSize:      z.string().optional(),
    insideTheBox: z.string().optional(),
    compatibility: z.string().optional(),

    // Attributes
    material: z.array(z.string()).optional(),
    pattern:  z.string().optional(),
    gender:   z.enum(['', 'Men', 'Women', 'Unisex', 'Kids']).optional(),

    // Spec table + highlights
    specifications: z.array(z.object({ key: z.string().optional(), value: z.string().optional() })).optional(),
    highlights:     z.array(z.string()).optional(),

    // Dimensions / warranty / shipping
    dimensions: z.object({
        length: z.number().min(0).optional(),
        width:  z.number().min(0).optional(),
        height: z.number().min(0).optional(),
    }).optional(),
    warranty: z.object({
        hasWarranty:  z.boolean().optional(),
        duration:     z.number().min(0).optional(),
        durationUnit: z.enum(['days', 'months', 'years']).optional(),
        type:         z.enum(['manufacturer', 'seller', 'none']).optional(),
    }).optional(),
    shippingConfig: z.object({
        freeShipping:  z.boolean().optional(),
        shippingCost:  z.number().min(0).optional(),
        estimatedDays: z.number().min(0).optional(),
    }).optional(),
    codAvailable: z.boolean().optional(),

    // Status
    status:     z.enum(['active', 'draft', 'out-of-stock']).optional(),
    visibility: z.enum(['visible', 'hidden']).optional(),
    isFeatured:   z.boolean().optional(),
    isNewProduct: z.boolean().optional(),
    isOnSale:     z.boolean().optional(),
    isBestSelling: z.boolean().optional(),

    // Base stock (used when no variants)
    stock: z.number().min(0).optional(),
    lowStockThreshold: z.number().min(0).optional(),
    unit: z.string().optional(),

    // Image Search / Filter
    tags:     z.array(z.string()).optional(),
    colors:   z.array(z.string()).optional(),
    colorHex: z.array(z.string()).optional(),
    sizes:    z.array(z.string()).optional(),
    aiLabels: z.array(z.string()).optional(),

    // Variants — each color+size combo with its own price/stock/images
    variants: z.array(
        z.object({
            label:         z.string().optional(),
            color:         z.string().optional(),
            colorHex:      z.string().optional(),
            size:          z.string().optional(),
            description:   z.string().optional(),   // variant-specific description (was silently dropped)
            price:         z.number().min(0, 'Variant price required'),
            originalPrice: z.number().min(0).optional().nullable(),
            stock:         z.number().min(0).optional(),
            sku:           z.string().optional(),
            images:        z.array(z.string()).optional(),
            note:          z.string().optional(),
        })
    ).optional(),

    // Content Tabs
    deliveryInfo: z.string().optional(),
    paymentInfo:  z.string().optional(),
    termsInfo:    z.string().optional(),

    // SEO
    metaTitle:       z.string().optional(),
    metaDescription: z.string().optional(),
    metaKeywords:    z.array(z.string()).optional(),
});

// ── Min-3-images rule (1 thumbnail + 2 more) ────────────────────────────
// Combined set [thumbnail, ...images] must contain at least 3 non-empty entries.
const hasMinThreeImages = (data: { thumbnail?: string; images?: string[] }) => {
    const combined = [data.thumbnail, ...(data.images ?? [])].filter(
        (img) => typeof img === 'string' && img.trim().length > 0
    );
    return combined.length >= 3;
};
const minImagesMessage = 'At least 3 product images are required (1 thumbnail + 2 more)';

export const createProductValidation = z.object({
    body: productCreateShape.refine(hasMinThreeImages, {
        message: minImagesMessage,
        path: ['images'],
    }),
});

export const updateProductValidation = z.object({
    body: productCreateShape.partial(),
});

// ── Bulk upload — array of the product create shape ─────────────────────
// Each row also enforces the min-3-images rule so invalid rows are caught.
export const bulkUploadValidation = z.object({
    body: z.object({
        products: z
            .array(
                productCreateShape.refine(hasMinThreeImages, {
                    message: minImagesMessage,
                    path: ['images'],
                })
            )
            .min(1, 'At least one product is required'),
    }),
});

export const bulkStatusValidation = z.object({
    body: z.object({
        ids:    z.array(z.string()).min(1),
        status: z.enum(['active', 'draft', 'out-of-stock']),
    }),
});

export const bulkDeleteValidation = z.object({
    body: z.object({
        ids: z.array(z.string()).min(1),
    }),
});
