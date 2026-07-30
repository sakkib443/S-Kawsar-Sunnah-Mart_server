import { Order } from '../order/order.model';
import AppError from '../../utils/AppError';
import SteadfastService from './steadfast.service';

// ── Status sets shared across booking / listing / sync ───────────────
const BOOKABLE_STATUSES = ['pending', 'confirmed', 'processing'];          // can still go to courier
const IN_TRANSIT_STATUSES = ['shipped', 'on_the_way', 'out_for_delivery', 'delivery_attempt'];
const TERMINAL_STATUSES = ['delivered', 'cancelled', 'returned', 'refunded'];

// Map a raw Steadfast delivery_status → our order lifecycle status.
// Terminal states (delivered / cancelled) are flagged for admin confirmation
// instead of auto-applied, so a courier sync never silently moves an order to a
// money-affecting state.
function mapCourierStatus(raw: string): { suggested: string | null; terminal: boolean } {
    const v = (raw || '').toLowerCase();
    if (v === 'delivered' || v === 'partial_delivered') return { suggested: 'delivered', terminal: true };
    if (v === 'cancelled') return { suggested: 'cancelled', terminal: true };
    // in-transit / pending / hold / in_review / *_approval_pending / unknown
    return { suggested: 'on_the_way', terminal: false };
}

// COD only collects when the order is COD and not already paid online:
// items subtotal + the order's shipping fee.
function codFor(order: any): number {
    if (order.paymentMethod !== 'cod' || order.paymentStatus === 'paid') return 0;
    return (order.subtotal || 0) + (order.shippingCost || 0);
}

// ── Core booking on an ALREADY-LOADED order doc (no save) ────────────
async function bookOrderCore(order: any) {
    if (order.consignmentId) throw new AppError(400, 'Already booked with Steadfast.');
    if (TERMINAL_STATUSES.includes(order.status)) throw new AppError(400, `Order is ${order.status} — cannot book.`);

    const a = order.shippingAddress;
    const fullAddress = [a.address, a.area, a.city, a.postalCode].filter(Boolean).join(', ');

    const consignment = await SteadfastService.createConsignment({
        invoice: String(order.orderId),
        recipientName: a.fullName,
        recipientPhone: (a.phone || '').replace(/\D/g, '').slice(-11),
        recipientAddress: fullAddress,
        codAmount: codFor(order),
        note: order.note || '',
    });

    order.consignmentId = String(consignment.consignment_id);
    order.trackingNumber = consignment.tracking_code || '';
    order.carrier = 'Steadfast';
    order.courierStatus = String(consignment.status || 'in_review');
    order.courierBookedAt = new Date();
    if (BOOKABLE_STATUSES.includes(order.status)) {
        order.status = 'shipped';
        order.timeline.push({ status: 'shipped', note: `Booked with Steadfast — tracking ${order.trackingNumber}` });
    }
    return order;
}

// ── Core status refresh on an ALREADY-LOADED order doc (no save) ─────
async function refreshOrderCore(order: any) {
    if (!order.trackingNumber && !order.consignmentId) {
        throw new AppError(400, 'Order has not been booked with Steadfast yet.');
    }

    const data = order.trackingNumber
        ? await SteadfastService.getStatusByTrackingCode(order.trackingNumber)
        : await SteadfastService.getStatusByCid(order.consignmentId);

    const raw = String(data?.delivery_status || '');
    order.courierStatus = raw;
    const { suggested, terminal } = mapCourierStatus(raw);

    // Auto-advance only non-terminal in-transit states; leave delivered/cancelled
    // for the admin to confirm via the normal order control.
    if (suggested && !terminal && suggested !== order.status && IN_TRANSIT_STATUSES.includes(order.status)) {
        order.status = suggested;
        order.timeline.push({ status: suggested, note: `Steadfast: ${raw}` });
    }

    return {
        courierStatus: raw,
        orderStatus: order.status,
        needsConfirmation: terminal,      // UI prompts admin to confirm delivered/cancelled
        suggestedStatus: terminal ? suggested : null,
    };
}

const CourierService = {
    // ── Flat, filterable order list (the Shipments board) ──
    async listOrders(opts: {
        state?: string;       // all | to_ship | shipped | delivered | cancelled
        search?: string;      // order no / customer / phone / tracking
        page?: number;
        limit?: number;
    }) {
        const page = Math.max(1, Number(opts.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));

        const filter: any = {};
        // State filter (booking lifecycle)
        if (opts.state === 'to_ship') {
            filter.consignmentId = { $in: [null, ''] };
            filter.status = { $in: BOOKABLE_STATUSES };
        } else if (opts.state === 'shipped') {
            filter.consignmentId = { $nin: [null, ''] };
            filter.status = { $in: IN_TRANSIT_STATUSES };
        } else if (opts.state === 'delivered') {
            filter.status = 'delivered';
        } else if (opts.state === 'cancelled') {
            filter.status = { $in: ['cancelled', 'returned', 'refunded'] };
        }

        if (opts.search) {
            const rx = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { orderId: rx },
                { 'shippingAddress.fullName': rx },
                { 'shippingAddress.phone': rx },
                { trackingNumber: rx },
            ];
        }

        const [orders, total] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Order.countDocuments(filter),
        ]);

        const data = orders.map((o: any) => ({
            orderId: o._id,
            orderNo: o.orderId,
            status: o.status,
            subtotal: o.subtotal,
            itemCount: (o.items || []).length,
            // Up to 4 product thumbnails/details for this order.
            items: (o.items || []).slice(0, 4).map((it: any) => ({
                thumbnail: it.thumbnail,
                name: it.name,
                quantity: it.quantity,
                color: it.color,
                size: it.size,
            })),
            consignmentId: o.consignmentId || '',
            trackingNumber: o.trackingNumber || '',
            courierStatus: o.courierStatus || '',
            carrier: o.carrier || '',
            booked: !!o.consignmentId,
            paymentMethod: o.paymentMethod,
            paymentStatus: o.paymentStatus,
            codAmount: (o.paymentMethod === 'cod' && o.paymentStatus !== 'paid')
                ? (o.subtotal || 0) + (o.shippingCost || 0)
                : 0,
            customer: o.shippingAddress?.fullName || '',
            phone: o.shippingAddress?.phone || '',
            city: o.shippingAddress?.city || '',
            createdAt: o.createdAt,
        }));

        return {
            data,
            meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };
    },

    // ── Single book (kept for the order-detail page) ──
    async bookOrder(orderId: string) {
        const order: any = await Order.findById(orderId);
        if (!order) throw new AppError(404, 'Order not found.');
        await bookOrderCore(order);
        await order.save();
        return order;
    },

    // ── Bulk book — one Steadfast consignment per selected order ──
    async bulkBook(orderIds: string[]) {
        const results: { orderId: string; ok: boolean; trackingNumber?: string; error?: string }[] = [];
        for (const orderId of orderIds || []) {
            const order: any = await Order.findById(orderId);
            if (!order) {
                results.push({ orderId, ok: false, error: 'Order not found.' });
                continue;
            }
            try {
                await bookOrderCore(order);
                await order.save();
                results.push({ orderId, ok: true, trackingNumber: order.trackingNumber });
            } catch (e: any) {
                results.push({ orderId, ok: false, error: e?.message || 'Booking failed.' });
            }
        }
        const booked = results.filter((r) => r.ok).length;
        return { total: results.length, booked, failed: results.length - booked, results };
    },

    // ── Single status refresh (kept for the order-detail page) ──
    async refreshStatus(orderId: string) {
        const order: any = await Order.findById(orderId);
        if (!order) throw new AppError(404, 'Order not found.');
        const out = await refreshOrderCore(order);
        await order.save();
        return out;
    },

    // ── Bulk status refresh ──
    async bulkRefresh(orderIds: string[]) {
        const results: { orderId: string; ok: boolean; courierStatus?: string; needsConfirmation?: boolean; error?: string }[] = [];
        for (const orderId of orderIds || []) {
            const order: any = await Order.findById(orderId);
            if (!order) {
                results.push({ orderId, ok: false, error: 'Order not found.' });
                continue;
            }
            try {
                const out = await refreshOrderCore(order);
                await order.save();
                results.push({ orderId, ok: true, courierStatus: out.courierStatus, needsConfirmation: out.needsConfirmation });
            } catch (e: any) {
                results.push({ orderId, ok: false, error: e?.message || 'Refresh failed.' });
            }
        }
        const ok = results.filter((r) => r.ok).length;
        return { total: results.length, ok, failed: results.length - ok, results };
    },

    // ── Webhook: Steadfast pushes a delivery-status change to us ──
    // Payload commonly carries consignment_id / invoice / status (delivery_status).
    async applyWebhook(payload: any) {
        const cid = payload?.consignment_id ?? payload?.cid;
        const invoice: string = payload?.invoice || '';
        const raw = String(payload?.delivery_status || payload?.status || '');
        if (!cid && !invoice) throw new AppError(400, 'Webhook payload missing consignment_id / invoice.');

        const order: any = cid
            ? await Order.findOne({ consignmentId: String(cid) })
            : await Order.findOne({ orderId: invoice });
        if (!order) return { matched: false };

        order.courierStatus = raw;
        const { suggested, terminal } = mapCourierStatus(raw);
        if (suggested && !terminal && suggested !== order.status && IN_TRANSIT_STATUSES.includes(order.status)) {
            order.status = suggested;
            order.timeline.push({ status: suggested, note: `Steadfast webhook: ${raw}` });
        }
        await order.save();
        return { matched: true, orderStatus: order.status, needsConfirmation: terminal };
    },

    async getBalance() {
        return SteadfastService.getBalance();
    },
};

export default CourierService;
