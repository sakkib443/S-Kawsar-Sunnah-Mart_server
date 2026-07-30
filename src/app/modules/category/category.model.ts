import { Schema, model } from 'mongoose';

const categorySchema = new Schema(
    {
        name: { type: String, required: [true, 'Category name is required'], trim: true, maxlength: 100 },
        slug: { type: String, unique: true, lowercase: true },
        description: { type: String, default: '' },
        icon: { type: String, default: '' },
        image: { type: String, default: '' },
        banner: { type: String, default: '' },
        parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
        level: { type: Number, default: 0 }, // 0=root, 1=sub, 2=sub-sub
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        isFeatured: { type: Boolean, default: false },
        showInMenu: { type: Boolean, default: true },
        showInHome: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false },
        productCount: { type: Number, default: 0 },
        metaTitle: { type: String, default: '' },
        metaDescription: { type: String, default: '' },
    },
    { timestamps: true, toJSON: { virtuals: true } }
);

categorySchema.index({ parent: 1 });
categorySchema.index({ isActive: 1, isDeleted: 1 });

// Auto-generate slug
categorySchema.pre('save', function (next) {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    next();
});

export const Category = model('Category', categorySchema);
