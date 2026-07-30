import { Types } from 'mongoose';
import { ActivityLog } from './activityLog.model';

export interface LogActivityInput {
    actor?: string | Types.ObjectId | null;
    actorName?: string;
    action: string;
    target?: string;
    meta?: unknown;
}

const ActivityLogService = {
    /**
     * Persist an admin activity record. Fire-and-forget: this NEVER throws,
     * so callers can safely invoke it without try/catch around the await.
     */
    async logActivity(input: LogActivityInput) {
        try {
            return await ActivityLog.create({
                actor: input.actor || null,
                actorName: input.actorName || '',
                action: input.action,
                target: input.target || '',
                meta: input.meta ?? {},
            });
        } catch {
            // Logging must never break the action it is recording.
            return null;
        }
    },

    /**
     * Admin: paginated, newest-first list of activity logs.
     */
    async getAll(query: Record<string, unknown>) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (query.action) filter.action = query.action;
        if (query.actor) filter.actor = query.actor;

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .populate('actor', 'firstName lastName email role avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            ActivityLog.countDocuments(filter),
        ]);

        return {
            logs,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },
};

export { ActivityLogService };
export default ActivityLogService;
