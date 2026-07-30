import AppError from '../../utils/AppError';
import { NewsletterSubscriber } from './newsletter.model';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NewsletterService = {
    /**
     * Public: subscribe an email. Idempotent — re-subscribing an existing
     * email is a no-op (no error), so the storefront never shows a failure
     * for an already-subscribed visitor.
     */
    async subscribe(rawEmail: string) {
        const email = (rawEmail || '').trim().toLowerCase();
        if (!email || !EMAIL_RE.test(email)) {
            throw new AppError(400, 'Please provide a valid email address.');
        }

        const existing = await NewsletterSubscriber.findOne({ email });
        if (existing) return existing;

        try {
            return await NewsletterSubscriber.create({ email });
        } catch (err: any) {
            // Duplicate key from a race — treat as already-subscribed.
            if (err?.code === 11000) {
                return NewsletterSubscriber.findOne({ email });
            }
            throw err;
        }
    },

    /**
     * Admin: paginated, newest-first list of subscribers.
     */
    async getAll(query: Record<string, unknown>) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (query.search) {
            filter.email = { $regex: String(query.search).trim(), $options: 'i' };
        }

        const [subscribers, total] = await Promise.all([
            NewsletterSubscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            NewsletterSubscriber.countDocuments(filter),
        ]);

        return {
            subscribers,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },
};

export { NewsletterService };
export default NewsletterService;
