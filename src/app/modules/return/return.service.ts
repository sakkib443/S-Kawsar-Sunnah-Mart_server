import { ReturnRequest } from './return.model';
import { Order } from '../order/order.model';
import OrderService from '../order/order.service';
import AppError from '../../utils/AppError';

interface Requester {
    userId: string;
    role: string;
}

const ReturnService = {
    // ── Customer: create a return request on a delivered order ──────
    async createReturn(userId: string, payload: any) {
        const { orderId, items, reason, description, images } = payload;

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) throw new AppError(404, 'Order not found');
        if (order.status !== 'delivered') {
            throw new AppError(400, 'Returns can only be requested for delivered orders');
        }

        // Snapshot the selected items from the order + compute refund amount
        const orderItems = (order as any).items || [];
        const snapshotItems: any[] = [];
        let refundAmount = 0;

        for (const sel of items) {
            const oi = orderItems.find((it: any) => it.product?.toString() === sel.product);
            if (!oi) throw new AppError(400, `Item not found in this order: ${sel.product}`);
            const qty = Math.min(sel.quantity, oi.quantity);
            snapshotItems.push({
                product: oi.product,
                name: oi.name,
                thumbnail: oi.thumbnail || '',
                price: oi.price,
                quantity: qty,
            });
            refundAmount += oi.price * qty;
        }

        const doc = await ReturnRequest.create({
            order: order._id,
            orderId: order.orderId || order._id.toString(),
            user: userId,
            items: snapshotItems,
            reason,
            description: description || '',
            images: images || [],
            status: 'pending',
            refundAmount,
            timeline: [{ status: 'pending', note: 'Return request submitted', createdAt: new Date() }],
        });

        // ── Notify all admins of the new return request ──
        try {
            const { NotificationService } = require('../notification/notification.service');
            const { User } = require('../user/user.model');
            const returnIdStr = doc._id.toString();

            const fanOut = async () => {
                const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
                for (const admin of admins) {
                    await NotificationService.notify({
                        user: admin._id,
                        type: 'return_request',
                        title: 'New return request',
                        message: `A return was requested on order ${doc.orderId}.`,
                        link: '/dashboard/admin/returns',
                        meta: { returnId: returnIdStr, orderId: doc.orderId },
                    });
                }
            };
            fanOut().catch(() => {});
        } catch {
            // never block return creation
        }

        return doc;
    },

    async getMyReturns(userId: string) {
        return ReturnRequest.find({ user: userId }).sort({ createdAt: -1 });
    },

    async getReturnById(id: string, requester: Requester) {
        const doc = await ReturnRequest.findById(id)
            .populate('user', 'firstName lastName email phone')
            .populate('order', 'orderId status total');
        if (!doc) throw new AppError(404, 'Return request not found');

        const isOwner = (doc.user as any)?._id
            ? (doc.user as any)._id.toString() === requester.userId
            : doc.user.toString() === requester.userId;
        const isAdmin = requester.role === 'admin' || requester.role === 'superadmin';

        if (!isOwner && !isAdmin) {
            throw new AppError(403, 'You do not have permission to view this return request');
        }
        return doc;
    },

    // ── Admin: list all returns ────────────────────────────────────
    async getAllReturns(query: Record<string, unknown>) {
        const filter: any = {};
        if (query.status) filter.status = query.status;
        return ReturnRequest.find(filter)
            .populate('user', 'firstName lastName email phone')
            .sort({ createdAt: -1 });
    },

    // ── Approve (admin) ────────────────────────────────────────────
    async approveReturn(id: string, resolver: { userId: string }, note?: string) {
        const doc = await ReturnRequest.findById(id);
        if (!doc) throw new AppError(404, 'Return request not found');

        if (doc.status !== 'pending') {
            throw new AppError(400, `Cannot approve a return that is already "${doc.status}"`);
        }

        doc.status = 'approved';
        doc.resolvedBy = resolver.userId as any;
        doc.resolvedAt = new Date();
        doc.timeline.push({ status: 'approved', note: note || 'Return approved', createdAt: new Date() } as any);
        await doc.save();

        // Reflect on the order: mark it returned
        await OrderService.markOrderReturned(doc.order, note);

        // ── Notify the customer that their return was approved (fire-and-forget) ──
        try {
            const { NotificationService } = require('../notification/notification.service');
            NotificationService.notify({
                user: doc.user.toString(),
                type: 'return_update',
                title: 'Return approved',
                message: `Your return request for order ${doc.orderId} was approved.`,
                link: '/dashboard/user/returns',
                meta: { returnId: doc._id.toString(), orderId: doc.orderId, status: 'approved' },
            }).catch(() => {});
        } catch {
            // never block return approval
        }

        return doc;
    },

    // ── Reject (admin) ─────────────────────────────────────────────
    async rejectReturn(id: string, resolver: { userId: string }, rejectionReason: string) {
        const doc = await ReturnRequest.findById(id);
        if (!doc) throw new AppError(404, 'Return request not found');

        if (doc.status !== 'pending') {
            throw new AppError(400, `Cannot reject a return that is already "${doc.status}"`);
        }

        doc.status = 'rejected';
        doc.rejectionReason = rejectionReason;
        doc.resolvedBy = resolver.userId as any;
        doc.resolvedAt = new Date();
        doc.timeline.push({ status: 'rejected', note: rejectionReason, createdAt: new Date() } as any);
        await doc.save();

        return doc;
    },

    // ── Refund (admin only) ────────────────────────────────────────
    async refundReturn(id: string, resolver: { userId: string }, note?: string) {
        const doc = await ReturnRequest.findById(id);
        if (!doc) throw new AppError(404, 'Return request not found');

        if (doc.status !== 'approved') {
            throw new AppError(400, `Only approved returns can be refunded (current: "${doc.status}")`);
        }

        doc.status = 'refunded';
        doc.resolvedBy = resolver.userId as any;
        doc.resolvedAt = new Date();
        doc.timeline.push({ status: 'refunded', note: note || 'Refund processed', createdAt: new Date() } as any);
        await doc.save();

        // Reflect on the order: mark it refunded + flip payment status
        await OrderService.markOrderRefunded(doc.order, note);

        // ── Notify the customer that their refund was processed (fire-and-forget) ──
        try {
            const { NotificationService } = require('../notification/notification.service');
            NotificationService.notify({
                user: doc.user.toString(),
                type: 'return_update',
                title: 'Refund processed',
                message: `Your refund of ৳${doc.refundAmount} for order ${doc.orderId} has been processed.`,
                link: '/dashboard/user/returns',
                meta: { returnId: doc._id.toString(), orderId: doc.orderId, status: 'refunded' },
            }).catch(() => {});
        } catch {
            // never block refund
        }

        return doc;
    },
};

export default ReturnService;
