import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFoundHandler from './app/middlewares/notFoundHandler';
import config from './app/config';

// ── Route Imports ────────────────────────────────────────────────
import { AuthRoutes } from './app/modules/auth/auth.routes';
import { UserRoutes } from './app/modules/user/user.routes';
import { CategoryRoutes } from './app/modules/category/category.routes';
import { ProductRoutes } from './app/modules/product/product.routes';
import { OrderRoutes } from './app/modules/order/order.routes';
import { ReviewRoutes } from './app/modules/review/review.routes';
import { CouponRoutes } from './app/modules/coupon/coupon.routes';
import { PaymentRoutes } from './app/modules/payment/payment.routes';
import { FinanceRoutes } from './app/modules/finance/finance.routes';
import { ShippingRoutes } from './app/modules/shipping/shipping.routes';
import { AnalyticsRoutes } from './app/modules/analytics/analytics.routes';
import { InquiryRoutes } from './app/modules/inquiry/inquiry.routes';
import { UploadRoutes } from './app/modules/upload/upload.routes';
import { SiteContentRoutes } from './app/modules/siteContent/siteContent.routes';
import { OfferRoutes } from './app/modules/offer/offer.routes';
import { RoleRoutes } from './app/modules/role/role.routes';
import { InvoiceRoutes } from './app/modules/invoice/invoice.routes';
import { ReturnRoutes } from './app/modules/return/return.routes';
import { NotificationRoutes } from './app/modules/notification/notification.routes';
import { ActivityLogRoutes } from './app/modules/activityLog/activityLog.routes';
import { NewsletterRoutes } from './app/modules/newsletter/newsletter.routes';
import { CourierRoutes } from './app/modules/courier/courier.routes';
import { ImageSearchRoutes } from './app/modules/imageSearch/imageSearch.routes';

const app: Application = express();

// ── Body Parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = [
    config.frontend_url,
    'http://localhost:3000',
    'http://localhost:3001',
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || config.env !== 'production') {
            callback(null, true);
        } else {
            callback(null, true); // Allow all for now
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Static: locally-stored image uploads ─────────────────────────
// Serves files written by disk storage (when Cloudinary isn't configured).
// e.g. GET /uploads/product_123.jpg
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── Health Check ─────────────────────────────────────────────────
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: '🛒 S Kawsar Sunnah Mart API Server is running!',
        version: '1.0.0',
        environment: config.env,
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'API is healthy', uptime: process.uptime() });
});

// ── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', AuthRoutes);
app.use('/api/users', UserRoutes);
app.use('/api/categories', CategoryRoutes);
app.use('/api/products', ProductRoutes);
app.use('/api/orders', OrderRoutes);
app.use('/api/reviews', ReviewRoutes);
app.use('/api/coupons', CouponRoutes);
app.use('/api/payments', PaymentRoutes);
app.use('/api/finance', FinanceRoutes);
app.use('/api/shipping', ShippingRoutes);
app.use('/api/analytics', AnalyticsRoutes);
app.use('/api/inquiries', InquiryRoutes);
app.use('/api/upload', UploadRoutes);
app.use('/api/site-content', SiteContentRoutes);
app.use('/api/offers', OfferRoutes);
app.use('/api/roles', RoleRoutes);
app.use('/api/invoices', InvoiceRoutes);
app.use('/api/returns', ReturnRoutes);
app.use('/api/notifications', NotificationRoutes);
app.use('/api/activity-logs', ActivityLogRoutes);
app.use('/api/newsletter', NewsletterRoutes);
app.use('/api/courier', CourierRoutes);
app.use('/api/image-search', ImageSearchRoutes);

// ── Error Handlers ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
