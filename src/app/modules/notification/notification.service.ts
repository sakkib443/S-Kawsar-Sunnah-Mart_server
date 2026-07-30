import { Types } from 'mongoose';
import { Notification } from './notification.model';
import { getIO } from '../../utils/socket';

export interface NotifyInput {
    user: string | Types.ObjectId;
    type: string;
    title: string;
    message: string;
    link?: string;
    meta?: unknown;
}

const NotificationService = {
    // Create a single notification + push it live over Socket.IO.
    // The socket emit is wrapped in try/catch so a transport failure
    // (or uninitialised io) never bubbles up to the caller.
    async notify(input: NotifyInput) {
        const notif = await Notification.create({
            user: input.user,
            type: input.type,
            title: input.title,
            message: input.message,
            link: input.link || '',
            meta: input.meta ?? {},
            isRead: false,
        });

        try {
            getIO().to('user:' + input.user.toString()).emit('notification:new', notif);
        } catch {
            // Socket not ready / emit failed — persisted record is enough.
        }

        return notif;
    },

    // Fan out the same (or per-recipient) notification to many users.
    async notifyMany(list: NotifyInput[]) {
        const results = [];
        for (const item of list) {
            results.push(await this.notify(item));
        }
        return results;
    },

    // Send the same notification to every admin / superadmin. Fire-and-forget by
    // design: a notification failure must never break the action that triggered
    // it (an order, a review, a contact message), so this never throws.
    async notifyAdmins(input: Omit<NotifyInput, 'user'>) {
        try {
            // Required lazily to avoid a circular import at module load time.
            const { User } = require('../user/user.model');
            const admins = await User.find({
                role: { $in: ['admin', 'superadmin'] },
                isDeleted: { $ne: true },
            }).select('_id');
            for (const admin of admins) {
                await this.notify({ ...input, user: admin._id });
            }
            return admins.length;
        } catch {
            return 0;
        }
    },

    // Paginated, newest-first list of a user's notifications.
    async getMy(userId: string, query: Record<string, unknown>) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = { user: userId };
        if (query.isRead !== undefined) {
            filter.isRead = query.isRead === 'true' || query.isRead === true;
        }

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notification.countDocuments(filter),
            Notification.countDocuments({ user: userId, isRead: false }),
        ]);

        return {
            notifications,
            unreadCount,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },

    // Mark one notification as read (scoped to its owner).
    async markRead(id: string, userId: string) {
        return Notification.findOneAndUpdate(
            { _id: id, user: userId },
            { $set: { isRead: true } },
            { new: true }
        );
    },

    // Mark every unread notification for a user as read.
    async markAllRead(userId: string) {
        const result = await Notification.updateMany(
            { user: userId, isRead: false },
            { $set: { isRead: true } }
        );
        return { modified: result.modifiedCount };
    },

    // Unread badge count.
    async getUnreadCount(userId: string) {
        const count = await Notification.countDocuments({ user: userId, isRead: false });
        return { count };
    },
};

export { NotificationService };
export default NotificationService;
