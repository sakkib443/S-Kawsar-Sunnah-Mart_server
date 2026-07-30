import { Offer } from './offer.model';
import AppError from '../../utils/AppError';

// Product fields the storefront cards need (keep payload lean).
const PRODUCT_FIELDS =
    'name slug price originalPrice discount images thumbnail rating reviewCount totalSold stock visibility';

const OfferService = {
    // ── Public: only active offers currently within their time window ──
    async getActive(type?: string) {
        const now = new Date();
        const query: Record<string, unknown> = {
            isActive: true,
            startTime: { $lte: now },
            endTime: { $gt: now },
        };
        if (type) query.type = type;

        const offers = await Offer.find(query)
            .sort({ sortOrder: 1, createdAt: -1 })
            .populate({
                path: 'products',
                select: PRODUCT_FIELDS,
                match: { visibility: { $ne: 'hidden' } },
            });

        // Drop products that failed the populate match (null entries).
        return offers.map((o) => {
            const obj = o.toObject();
            obj.products = (obj.products || []).filter(Boolean);
            return obj;
        });
    },

    // ── Admin ──
    async getAll() {
        return await Offer.find()
            .sort({ sortOrder: 1, createdAt: -1 })
            .populate({ path: 'products', select: PRODUCT_FIELDS });
    },

    async getById(id: string) {
        const offer = await Offer.findById(id).populate({ path: 'products', select: PRODUCT_FIELDS });
        if (!offer) throw new AppError(404, 'Offer not found');
        return offer;
    },

    async create(payload: Record<string, unknown>) {
        return await Offer.create(payload);
    },

    async update(id: string, payload: Record<string, unknown>) {
        const offer = await Offer.findByIdAndUpdate(id, payload, { new: true });
        if (!offer) throw new AppError(404, 'Offer not found');
        return offer;
    },

    async delete(id: string) {
        const offer = await Offer.findByIdAndDelete(id);
        if (!offer) throw new AppError(404, 'Offer not found');
        return offer;
    },
};

export default OfferService;
