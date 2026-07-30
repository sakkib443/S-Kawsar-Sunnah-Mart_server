import { Order } from '../order/order.model';

/**
 * FINANCE — the single source of truth for money.
 *
 * Definitions (all derived from PAID orders only, so nothing counts until the
 * money is actually collected — COD flips to paid on delivery, gateways on
 * confirmation):
 *   revenue        Σ order.total            money collected (incl. shipping, net of discount)
 *   productRevenue Σ (subtotal − discount)  goods revenue, net of discount, EXCLUDES shipping
 *   cost (COGS)    Σ item.cost × qty        cost of goods sold (snapshotted at purchase)
 *   netProfit      productRevenue − cost    profit after cost of goods (shipping is passthrough)
 *   margin         netProfit / productRevenue
 *   aov            revenue / paidOrders
 */

export interface FinanceSummary {
    revenue: number;
    productRevenue: number;
    cost: number;
    grossProfit: number;
    netProfit: number;
    margin: number;        // 0..1
    shipping: number;
    discount: number;
    paidOrders: number;
    aov: number;
}

export interface MethodBreakdown {
    method: string;
    orders: number;
    revenue: number;
    netProfit: number;
}

const paidMatch = (from?: Date, to?: Date) => {
    const m: Record<string, any> = { paymentStatus: 'paid' };
    if (from || to) {
        m.createdAt = {};
        if (from) m.createdAt.$gte = from;
        if (to) m.createdAt.$lte = to;
    }
    return m;
};

// Per-order projection that adds the order's COGS from its line items.
const withOrderCost = {
    $project: {
        total: 1,
        subtotal: 1,
        discount: 1,
        shippingCost: 1,
        paymentMethod: 1,
        createdAt: 1,
        orderCost: {
            $sum: {
                $map: {
                    input: { $ifNull: ['$items', []] },
                    as: 'it',
                    in: { $multiply: [{ $ifNull: ['$$it.cost', 0] }, { $ifNull: ['$$it.quantity', 0] }] },
                },
            },
        },
    },
};

const emptySummary: FinanceSummary = {
    revenue: 0, productRevenue: 0, cost: 0, grossProfit: 0, netProfit: 0,
    margin: 0, shipping: 0, discount: 0, paidOrders: 0, aov: 0,
};

const shape = (r: any): FinanceSummary => {
    const revenue = r?.revenue || 0;
    const productRevenue = r?.productRevenue || 0;
    const cost = r?.cost || 0;
    const netProfit = productRevenue - cost;
    const paidOrders = r?.paidOrders || 0;
    return {
        revenue,
        productRevenue,
        cost,
        grossProfit: netProfit,
        netProfit,
        margin: productRevenue > 0 ? netProfit / productRevenue : 0,
        shipping: r?.shipping || 0,
        discount: r?.discount || 0,
        paidOrders,
        aov: paidOrders > 0 ? revenue / paidOrders : 0,
    };
};

export async function computeFinanceSummary(from?: Date, to?: Date): Promise<FinanceSummary> {
    const agg = await Order.aggregate([
        { $match: paidMatch(from, to) },
        withOrderCost,
        {
            $group: {
                _id: null,
                revenue: { $sum: { $ifNull: ['$total', 0] } },
                productRevenue: { $sum: { $subtract: [{ $ifNull: ['$subtotal', 0] }, { $ifNull: ['$discount', 0] }] } },
                cost: { $sum: '$orderCost' },
                shipping: { $sum: { $ifNull: ['$shippingCost', 0] } },
                discount: { $sum: { $ifNull: ['$discount', 0] } },
                paidOrders: { $sum: 1 },
            },
        },
    ]);
    return shape(agg[0]);
}

// Revenue + net profit split by payment method (for the admin breakdown).
export async function computeMethodBreakdown(from?: Date, to?: Date): Promise<MethodBreakdown[]> {
    const agg = await Order.aggregate([
        { $match: paidMatch(from, to) },
        withOrderCost,
        {
            $group: {
                _id: '$paymentMethod',
                orders: { $sum: 1 },
                revenue: { $sum: { $ifNull: ['$total', 0] } },
                productRevenue: { $sum: { $subtract: [{ $ifNull: ['$subtotal', 0] }, { $ifNull: ['$discount', 0] }] } },
                cost: { $sum: '$orderCost' },
            },
        },
        { $sort: { revenue: -1 } },
    ]);
    return agg.map((r: any) => ({
        method: r._id || 'unknown',
        orders: r.orders || 0,
        revenue: r.revenue || 0,
        netProfit: (r.productRevenue || 0) - (r.cost || 0),
    }));
}

// Monthly revenue + net-profit series (last `months`).
export async function computeMonthlySeries(months = 12): Promise<
    { year: number; month: number; label: string; revenue: number; netProfit: number; orders: number }[]
> {
    const agg = await Order.aggregate([
        { $match: paidMatch() },
        withOrderCost,
        {
            $group: {
                _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                revenue: { $sum: { $ifNull: ['$total', 0] } },
                productRevenue: { $sum: { $subtract: [{ $ifNull: ['$subtotal', 0] }, { $ifNull: ['$discount', 0] }] } },
                cost: { $sum: '$orderCost' },
                orders: { $sum: 1 },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return agg.slice(-months).map((r: any) => ({
        year: r._id.year,
        month: r._id.month,
        label: labels[r._id.month - 1],
        revenue: r.revenue || 0,
        netProfit: (r.productRevenue || 0) - (r.cost || 0),
        orders: r.orders || 0,
    }));
}

export interface LedgerRow {
    orderId: string;
    date: Date;
    customer: string;
    method: string;
    revenue: number;
    cost: number;
    profit: number;
}

// Line-by-line paid-order ledger (newest first) for the report/export.
export async function computeLedger(from?: Date, to?: Date, limit = 1000): Promise<LedgerRow[]> {
    const rows = await Order.aggregate([
        { $match: paidMatch(from, to) },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        {
            $addFields: {
                orderCost: {
                    $sum: {
                        $map: {
                            input: { $ifNull: ['$items', []] },
                            as: 'it',
                            in: { $multiply: [{ $ifNull: ['$$it.cost', 0] }, { $ifNull: ['$$it.quantity', 0] }] },
                        },
                    },
                },
            },
        },
    ]);
    return rows.map((r: any) => {
        const revenue = r.total || 0;
        const cost = r.orderCost || 0;
        const productRevenue = (r.subtotal || 0) - (r.discount || 0);
        return {
            orderId: r.orderId || String(r._id),
            date: r.createdAt,
            customer: r.shippingAddress?.fullName || 'Customer',
            method: r.paymentMethod || 'unknown',
            revenue,
            cost,
            profit: productRevenue - cost,
        };
    });
}

export { emptySummary };
