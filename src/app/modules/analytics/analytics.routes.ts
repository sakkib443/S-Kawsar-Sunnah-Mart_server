import express from 'express';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import AnalyticsController from './analytics.controller';

const router = express.Router();

// ════════════════════════════════════════════════════════════
//  ADMIN ANALYTICS — everything below requires admin auth.
// ════════════════════════════════════════════════════════════
router.use(authMiddleware, authorizeRoles('admin'));

router.get('/dashboard', AnalyticsController.getDashboardSummary);
router.get('/monthly-revenue', AnalyticsController.getMonthlyRevenue);
router.get('/recent-orders', AnalyticsController.getRecentOrders);
router.get('/top-products', AnalyticsController.getTopProducts);
router.get('/sales-by-category', AnalyticsController.getSalesByCategory);

// ── Admin enhancements ──
router.get('/low-stock', AnalyticsController.getLowStock);
router.get('/returns-summary', AnalyticsController.getReturnsSummary);
router.get('/report/pdf', AnalyticsController.getAdminReportPdf);

export const AnalyticsRoutes = router;
