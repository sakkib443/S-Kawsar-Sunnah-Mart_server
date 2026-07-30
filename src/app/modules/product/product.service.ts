import { Product } from './product.model';
import { Category } from '../category/category.model';
import AppError from '../../utils/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { bulkUploadValidation } from './product.validation';

// Per-row product shape (one entry of bulkUploadValidation.body.products) — used to
// validate each bulk row individually so one bad row doesn't abort the whole batch.
const bulkProductRowSchema = bulkUploadValidation.shape.body.shape.products.element;

// Escape user input before embedding it in a RegExp (prevents regex injection /
// accidental special-char matches in brand + suggest queries).
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ProductService = {
    // ── Get all products (public, with full filtering) ──────────────────
    async getAllProducts(query: Record<string, unknown>) {
        // (Product sourcing "country" was removed.) Drop any stale ?country= param
        // so it never leaks into the Mongoose filter.
        delete (query as Record<string, unknown>).country;

        // Legacy ?shop= param (multi-vendor) is no longer supported — strip it.
        delete query.shop;

        // ── Extra server-side filters (brand / minRating / inStock) ──────────
        // Normalize empty / "all" so they never leak into Mongoose .find().
        // Each builds a Mongoose condition fragment that is AND-combined with the
        // publicScope + the other filters, and is also re-injected into the
        // search+category rebuild path below (same as shop/country).

        // brand: case-insensitive exact match; comma-separated → match any (in-list).
        const rawBrand = typeof query.brand === 'string' ? query.brand.trim() : '';
        let brandFilter: Record<string, unknown> | undefined;
        if (rawBrand && rawBrand.toLowerCase() !== 'all') {
            const brands = rawBrand
                .split(',')
                .map((b) => b.trim())
                .filter(Boolean);
            if (brands.length === 1) {
                // anchored, case-insensitive exact match
                brandFilter = { brand: { $regex: `^${escapeRegex(brands[0])}$`, $options: 'i' } };
            } else if (brands.length > 1) {
                brandFilter = {
                    $or: brands.map((b) => ({ brand: { $regex: `^${escapeRegex(b)}$`, $options: 'i' } })),
                };
            }
        }
        // Remove raw brand so QueryBuilder.filter() doesn't do a literal equality match.
        delete query.brand;

        // minRating: rating >= value.
        const minRatingNum = Number(query.minRating);
        const minRating =
            query.minRating !== undefined &&
            query.minRating !== '' &&
            query.minRating !== 'all' &&
            Number.isFinite(minRatingNum)
                ? minRatingNum
                : undefined;
        const ratingFilter: Record<string, unknown> | undefined =
            minRating !== undefined ? { rating: { $gte: minRating } } : undefined;
        delete query.minRating;

        // inStock=true: stock > 0 AND status not 'out-of-stock'.
        const inStock = query.inStock === 'true' || query.inStock === true;
        const stockFilter: Record<string, unknown> | undefined = inStock
            ? { stock: { $gt: 0 }, status: { $ne: 'out-of-stock' } }
            : undefined;
        delete query.inStock;

        // Merchandising flags: ?isFeatured / ?isOnSale / ?isNewProduct / ?isBestSelling
        // = true → the storefront's Featured / On-Sale / New / Top Selling sections
        // filter by the admin toggles.
        const flagConds: Record<string, unknown> = {};
        (['isFeatured', 'isOnSale', 'isNewProduct', 'isBestSelling'] as const).forEach((f) => {
            if (query[f] === 'true' || query[f] === true) flagConds[f] = true;
            delete query[f];
        });
        const flagFilter: Record<string, unknown> | undefined =
            Object.keys(flagConds).length > 0 ? flagConds : undefined;

        // category: match products whose PRIMARY category OR sub-category equals the id.
        // A product stores its root in `category` and (optionally) its child in
        // `subCategory`; selecting either a root OR a sub-category in the filter must
        // return that product. (Handled here instead of QueryBuilder.filter()'s literal
        // equality, which only matched `category` and returned 0 rows for sub-categories.)
        const rawCategory = typeof query.category === 'string' ? query.category.trim() : '';
        let categoryFilter: Record<string, unknown> | undefined;
        if (rawCategory && rawCategory.toLowerCase() !== 'all') {
            categoryFilter = { $or: [{ category: rawCategory }, { subCategory: rawCategory }] };
        }
        // Remove raw category so QueryBuilder.filter() doesn't re-add a literal match.
        delete query.category;

        // Collected extra conditions, AND-combined wherever the base filter is built.
        const extraFilters: Record<string, unknown>[] = [
            brandFilter,
            ratingFilter,
            stockFilter,
            categoryFilter,
            flagFilter,
        ].filter(Boolean) as Record<string, unknown>[];
        const extraFilterMerge: Record<string, unknown> =
            extraFilters.length > 0 ? { $and: extraFilters } : {};

        // Public listing base scope: non-deleted, approved, and not-hidden products.
        // NOTE: use $ne checks (not strict equals) so legacy/seeded products whose
        // visibility field is unset are still shown — only products
        // explicitly 'hidden' are excluded.
        // (Shared by both the normal path and the search+category rebuild path.)
        const publicScope: Record<string, unknown> = {
            isDeleted: false,
            visibility: { $ne: 'hidden' },
            ...extraFilterMerge,
        };

        // If searching, also look for matching categories by name
        let categoryIds: string[] = [];
        if (query.searchTerm) {
            const matchingCategories = await Category.find({
                name: { $regex: query.searchTerm as string, $options: 'i' },
            }).select('_id');
            categoryIds = matchingCategories.map((c) => c._id.toString());
        }

        // Build base query — if we found matching categories, include them
        // Public listing: only approved + visible products are shown.
        let baseFilter: any = { ...publicScope };
        if (categoryIds.length > 0 && query.searchTerm) {
            // Will be merged with search conditions via $and
            baseFilter = {
                ...publicScope,
                $or: [
                    { category: { $in: categoryIds } },
                    // The QueryBuilder.search() will add field-level search conditions
                    { _searchPlaceholder: true },
                ],
            };
        }

        const productQuery = new QueryBuilder(
            Product.find(categoryIds.length > 0 ? { ...publicScope } : baseFilter)
                .populate('category', 'name slug'),
            query
        )
            .search(['name', 'description', 'tags', 'colors', 'aiLabels', 'slug'])
            .filter()
            .sort()
            .paginate()
            .fields();

        // If we have matching category IDs, merge them into the query
        if (categoryIds.length > 0 && query.searchTerm) {
            const currentFilter = productQuery.modelQuery.getFilter();
            productQuery.modelQuery = Product.find({
                ...publicScope,
                $or: [
                    { category: { $in: categoryIds } },
                    ...(currentFilter.$and || [currentFilter]),
                ],
            })
                .populate('category', 'name slug');

            // Re-apply sort, paginate, fields
            const sort = (query?.sort as string)?.split(',')?.join(' ') || '-createdAt';
            const page = Number(query?.page) || 1;
            const limit = Number(query?.limit) || 10;
            const skip = (page - 1) * limit;
            productQuery.modelQuery = productQuery.modelQuery.sort(sort).skip(skip).limit(limit);
        }

        const products = await productQuery.modelQuery;
        const meta = await productQuery.countTotal();
        return { products, meta };
    },

    // ── Get single product ──────────────────────────────────────────────
    async getProductById(id: string) {
        const product = await Product.findOne({ _id: id, isDeleted: { $ne: true } })
            .populate('category', 'name slug');
        if (!product) throw new AppError(404, 'Product not found');

        // Increment view count
        await Product.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
        return product;
    },

    // ── Get product by slug ─────────────────────────────────────────────
    async getProductBySlug(slug: string) {
        // Public: only approved products are reachable by slug.
        const product = await Product.findOne({ slug, isDeleted: { $ne: true } })
            .populate('category', 'name slug');
        if (!product) throw new AppError(404, 'Product not found');
        await Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } });
        return product;
    },

    // ── Live search suggestions (public, fast, no pagination) ────────────
    // Returns up to `limit` approved+visible products whose name matches `q`
    // (case-insensitive), plus up to 5 matching categories. Blank q → empties.
    async suggestProducts(q: string, limit = 8) {
        const term = typeof q === 'string' ? q.trim() : '';
        if (!term) {
            return { products: [], categories: [] };
        }
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 8;
        const nameRegex = { $regex: escapeRegex(term), $options: 'i' };

        const [products, categories] = await Promise.all([
            Product.find({
                isDeleted: false,
                visibility: { $ne: 'hidden' },
                name: nameRegex,
            })
                .select('_id name slug thumbnail price discount')
                .sort({ totalSold: -1 })
                .limit(safeLimit),
            Category.find({
                isDeleted: { $ne: true },
                isActive: { $ne: false },
                name: nameRegex,
            })
                .select('_id name slug')
                .limit(5),
        ]);

        return { products, categories };
    },

    // ── Distinct brands (public) ─────────────────────────────────────────
    // Non-empty brand strings from approved+visible non-deleted products,
    // sorted alphabetically (case-insensitive).
    async getBrands(): Promise<string[]> {
        const brands: unknown[] = await Product.distinct('brand', {
            isDeleted: false,
            visibility: { $ne: 'hidden' },
        });
        return (brands as string[])
            .filter((b) => typeof b === 'string' && b.trim() !== '')
            .map((b) => b.trim())
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    },

    // ── Admin stats ─────────────────────────────────────────────────────
    async getProductStats() {
        const [total, active, draft, outOfStock] = await Promise.all([
            Product.countDocuments({ isDeleted: false }),
            Product.countDocuments({ isDeleted: false, status: 'active' }),
            Product.countDocuments({ isDeleted: false, status: 'draft' }),
            Product.countDocuments({ isDeleted: false, status: 'out-of-stock' }),
        ]);
        return { total, active, draft, outOfStock };
    },

    // ── Create product ──────────────────────────────────────────────────
    async createProduct(payload: any) {
        // Admin products are auto-approved and go live immediately.
        const product = await Product.create({ ...payload });

        // Update category product count
        await Category.findByIdAndUpdate(payload.category, { $inc: { productCount: 1 } });

        return product;
    },

    // ── Update product ──────────────────────────────────────────────────
    async updateProduct(id: string, payload: any) {
        // discount (base + per-variant) and variant labels are auto-derived in the
        // pre('save') hook. Drop any client-sent discount so it can't override the
        // calculation, then load → assign → save so those hooks actually run
        // (findOneAndUpdate would BYPASS them, leaving stale discounts on edit).
        delete payload.discount;

        const product = await Product.findOne({ _id: id, isDeleted: false });
        if (!product) throw new AppError(404, 'Product not found');

        const prevCategory = String(product.category);
        Object.assign(product, payload);
        await product.save();

        // Keep category product counts in sync when the category changes.
        if (payload.category && String(payload.category) !== prevCategory) {
            await Category.findByIdAndUpdate(prevCategory, { $inc: { productCount: -1 } });
            await Category.findByIdAndUpdate(payload.category, { $inc: { productCount: 1 } });
        }

        await product.populate('category', 'name slug');
        return product;
    },

    // ── Delete product (soft) ───────────────────────────────────────────
    async deleteProduct(id: string) {
        const product = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
        if (!product) throw new AppError(404, 'Product not found');

        // Update category product count
        await Category.findByIdAndUpdate(product.category, { $inc: { productCount: -1 } });
        return product;
    },

    // ── Bulk status update ──────────────────────────────────────────────
    async bulkUpdateStatus(ids: string[], status: string) {
        const result = await Product.updateMany(
            { _id: { $in: ids }, isDeleted: false },
            { status }
        );
        return result;
    },

    // ── Bulk delete ─────────────────────────────────────────────────────
    async bulkDelete(ids: string[]) {
        // Read the categories BEFORE the delete so each category's productCount can be
        // corrected — a bare updateMany() leaves the counts drifting upward forever
        // (single delete already decrements; bulk delete used to skip it).
        const doomed = await Product.find({ _id: { $in: ids }, isDeleted: false }).select('category');
        const result = await Product.updateMany({ _id: { $in: ids }, isDeleted: false }, { isDeleted: true });

        const perCategory = new Map<string, number>();
        doomed.forEach((p: any) => {
            const key = String(p.category);
            perCategory.set(key, (perCategory.get(key) || 0) + 1);
        });
        await Promise.all(
            Array.from(perCategory.entries()).map(([categoryId, n]) =>
                Category.findByIdAndUpdate(categoryId, { $inc: { productCount: -n } })
            )
        );

        return result;
    },

    // ── Bulk create / upload ─────────────────────────────────────────────
    // Validates each row independently; valid rows are inserted, invalid rows are
    // skipped and reported. Never aborts the whole batch for one bad row.
    // Admin upload: products go live immediately.
    async bulkCreate(items: any[]) {
        let created = 0;
        const failed: { index: number; error: string }[] = [];

        // Spreadsheet-friendly: a CSV row may name its category ("Electronics")
        // instead of pasting an ObjectId. Load the lookup once for the whole batch.
        const allCategories = await Category.find({ isDeleted: { $ne: true } }).select('_id name');
        const categoryByName = new Map<string, string>(
            allCategories.map((c: any) => [String(c.name).trim().toLowerCase(), String(c._id)]),
        );
        const categoryIds = new Set<string>(allCategories.map((c: any) => String(c._id)));

        // Returns the ObjectId for an id-or-name value, or null when unknown.
        const resolveCategory = (value: unknown): string | null => {
            const raw = String(value ?? '').trim();
            if (!raw) return null;
            if (categoryIds.has(raw)) return raw;                    // already an id
            return categoryByName.get(raw.toLowerCase()) || null;    // by name (case-insensitive)
        };

        for (let index = 0; index < items.length; index++) {
            const parsed = bulkProductRowSchema.safeParse(items[index]);
            if (!parsed.success) {
                const firstIssue = parsed.error.issues[0];
                const path = firstIssue?.path?.join('.') || 'unknown';
                failed.push({ index, error: `${path}: ${firstIssue?.message || 'Invalid product'}` });
                continue;
            }

            try {
                const payload: any = { ...parsed.data };

                const categoryId = resolveCategory(payload.category);
                if (!categoryId) {
                    failed.push({ index, error: `category: no category matches "${payload.category}" (use the exact category name or its id)` });
                    continue;
                }
                payload.category = categoryId;

                // subCategory is optional — but if given it must resolve too.
                if (payload.subCategory) {
                    const subId = resolveCategory(payload.subCategory);
                    if (!subId) {
                        failed.push({ index, error: `subCategory: no category matches "${payload.subCategory}"` });
                        continue;
                    }
                    payload.subCategory = subId;
                }

                // Use create() (not insertMany) so pre-save hooks run per row
                // (slug, sku, discount, variant labels) — same as single create.
                await Product.create(payload);
                await Category.findByIdAndUpdate(categoryId, { $inc: { productCount: 1 } });
                created++;
            } catch (err: any) {
                failed.push({ index, error: err?.message || 'Failed to create product' });
            }
        }

        return { created, failed };
    },

    // ── Inventory: low-stock products (admin) ────────────────────────────
    async getLowStockProducts(threshold = 5) {
        const safeThreshold = Number.isFinite(threshold) ? threshold : 5;
        return await Product.find({ isDeleted: false, stock: { $lte: safeThreshold } })
            .populate('category', 'name slug')
            .sort({ stock: 1 });
    },

    // ── Update stock (no longer needed — stock field removed) ───────────
    // Kept for API compatibility; status can still be set to out-of-stock manually

    // ── Featured products ───────────────────────────────────────────────
    // Prefer products the admin explicitly flagged as Featured; if none are
    // flagged yet, gracefully fall back to top sellers so the section is never empty.
    async getFeaturedProducts(limit = 8) {
        const base: Record<string, unknown> = { isDeleted: false, status: 'active', visibility: { $ne: 'hidden' } };
        const flagged = await Product.find({ ...base, isFeatured: true })
            .populate('category', 'name slug')
            .sort({ totalSold: -1, createdAt: -1 })
            .limit(limit);
        if (flagged.length > 0) return flagged;
        return await Product.find(base)
            .populate('category', 'name slug')
            .sort({ totalSold: -1 })
            .limit(limit);
    },

    // ── Related products (same category) ────────────────────────────────
    async getRelatedProducts(productId: string, categoryId: string, limit = 6) {
        return await Product.find({
            _id: { $ne: productId },
            category: categoryId,
            isDeleted: false,
            status: 'active',
            visibility: { $ne: 'hidden' }, // never leak hidden products into "related"
        })
            .populate('category', 'name slug')
            .sort({ rating: -1 })
            .limit(limit);
    },

    // ── Increment stat (like, share, view, comment) ─────────────────────
    async incrementStat(id: string, field: string) {
        const allowedFields = ['likeCount', 'shareCount', 'viewCount', 'commentCount'];
        if (!allowedFields.includes(field)) {
            throw new AppError(400, `Invalid stat field: ${field}`);
        }
        const product = await Product.findByIdAndUpdate(
            id,
            { $inc: { [field]: 1 } },
            { new: true }
        );
        if (!product) throw new AppError(404, 'Product not found');
        return product;
    },

};

export default ProductService;
