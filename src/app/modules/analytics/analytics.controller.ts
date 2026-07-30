import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { Order } from '../order/order.model';
import { Product } from '../product/product.model';
import { User } from '../user/user.model';
import { Category } from '../category/category.model';
import AnalyticsService from './analytics.service';
import { computeFinanceSummary } from '../finance/finance.service';

const AnalyticsController = {
    // GET /analytics/dashboard — Main dashboard summary
    getDashboardSummary: catchAsync(async (req: Request, res: Response) => {
        const [
            totalOrders,
            totalProducts,
            totalCustomers,
            totalCategories,
            pendingOrders,
            deliveredOrders,
        ] = await Promise.all([
            Order.countDocuments(),
            Product.countDocuments({ isDeleted: false }),
            User.countDocuments({ role: 'user' }),
            Category.countDocuments({ isActive: true }),
            Order.countDocuments({ status: 'pending' }),
            Order.countDocuments({ status: 'delivered' }),
        ]);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayOrders = await Order.countDocuments({ createdAt: { $gte: todayStart } });

        // Single source of truth for money: revenue, COGS, net profit, margin, AOV.
        const [allTime, today] = await Promise.all([
            computeFinanceSummary(),
            computeFinanceSummary(todayStart),
        ]);

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Dashboard summary fetched',
            data: {
                totalRevenue: allTime.revenue,
                totalCost: allTime.cost,
                netProfit: allTime.netProfit,
                profitMargin: allTime.margin,
                avgOrderValue: allTime.aov,
                paidOrders: allTime.paidOrders,
                totalOrders,
                totalProducts,
                totalCustomers,
                totalCategories,
                pendingOrders,
                deliveredOrders,
                todayOrders,
                todayRevenue: today.revenue,
                todayNetProfit: today.netProfit,
            },
        });
    }),

    // GET /analytics/monthly-revenue
    getMonthlyRevenue: catchAsync(async (req: Request, res: Response) => {
        const monthlyRevenue = await Order.aggregate([
            { $match: { paymentStatus: 'paid' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    revenue: { $sum: '$total' },
                    orders: { $sum: 1 },
                },
            },
            // Take the 12 MOST RECENT months (sort desc + limit), then re-order chronologically
            // below. Sorting ascending before $limit would keep the 12 OLDEST months and drop
            // the current period once the store has >12 months of paid orders.
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 },
        ]);

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const data = monthlyRevenue
            .reverse() // back to oldest → newest for the chart
            .map((item) => ({
                month: months[item._id.month - 1],
                year: item._id.year,
                revenue: item.revenue,
                orders: item.orders,
            }));

        sendResponse(res, { statusCode: 200, success: true, message: 'Monthly revenue fetched', data });
    }),

    // GET /analytics/recent-orders
    getRecentOrders: catchAsync(async (req: Request, res: Response) => {
        const limit = Number(req.query.limit) || 10;
        const orders = await Order.find()
            .populate('user', 'firstName lastName email')
            .sort('-createdAt')
            .limit(limit)
            .select('orderId user shippingAddress total status paymentStatus paymentMethod items createdAt');

        sendResponse(res, { statusCode: 200, success: true, message: 'Recent orders fetched', data: orders });
    }),

    // GET /analytics/top-products
    getTopProducts: catchAsync(async (req: Request, res: Response) => {
        const limit = Number(req.query.limit) || 10;
        const topProducts = await Product.find({ isDeleted: false })
            .sort('-totalSold')
            .limit(limit)
            .select('name thumbnail price totalSold stock category rating');

        sendResponse(res, { statusCode: 200, success: true, message: 'Top products fetched', data: topProducts });
    }),

    // GET /analytics/sales-by-category
    getSalesByCategory: catchAsync(async (req: Request, res: Response) => {
        const salesByCategory = await Order.aggregate([
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productInfo',
                },
            },
            { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productInfo.category',
                    foreignField: '_id',
                    as: 'categoryInfo',
                },
            },
            { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    // Products with no category (or a deleted one) fall into a single
                    // clearly-labelled "Uncategorized" bucket instead of a blank/null row.
                    _id: { $ifNull: ['$categoryInfo._id', 'uncategorized'] },
                    name: { $first: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] } },
                    totalSales: { $sum: '$items.total' },
                    totalItems: { $sum: '$items.quantity' },
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 10 },
        ]);

        sendResponse(res, { statusCode: 200, success: true, message: 'Sales by category fetched', data: salesByCategory });
    }),

    // ════════════════════════════════════════════════════════════
    //  ADMIN ENHANCEMENTS
    // ════════════════════════════════════════════════════════════

    // GET /analytics/low-stock?threshold=10
    getLowStock: catchAsync(async (req: Request, res: Response) => {
        const threshold = Number(req.query.threshold) || 10;
        const data = await AnalyticsService.getLowStock(threshold);
        sendResponse(res, { statusCode: 200, success: true, message: 'Low stock products fetched', data });
    }),

    // GET /analytics/returns-summary
    getReturnsSummary: catchAsync(async (req: Request, res: Response) => {
        const data = await AnalyticsService.getReturnsSummary();
        sendResponse(res, { statusCode: 200, success: true, message: 'Returns summary fetched', data });
    }),

    // GET /analytics/report/pdf
    getAdminReportPdf: catchAsync(async (req: Request, res: Response) => {
        const pdf = await AnalyticsService.generateAdminReportPdf();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="S Kawsar Sunnah Mart-Platform-Analytics.pdf"`);
        res.send(pdf);
    }),
};

export default AnalyticsController;
