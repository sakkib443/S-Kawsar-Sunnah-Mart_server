import express from 'express';
import CourierController from './courier.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';

const router = express.Router();

// ── Public: Steadfast delivery-status webhook (guarded by shared secret) ──
router.post('/webhook', CourierController.webhook);

// ── Admin / super admin: Steadfast courier management ──
const admin = [authMiddleware, authorizeRoles('admin', 'superadmin')];

// Shipments board — flat order list with state filters.
router.get('/orders', ...admin, CourierController.listOrders);

// Bulk actions (checkbox selections from the Shipments board).
router.post('/bulk-book', ...admin, CourierController.bulkBook);
router.post('/bulk-status', ...admin, CourierController.bulkRefresh);

// Single order (from the order-detail page).
router.post('/orders/:orderId/book', ...admin, CourierController.bookOrder);
router.get('/orders/:orderId/status', ...admin, CourierController.refreshStatus);

router.get('/balance', ...admin, CourierController.getBalance);

export const CourierRoutes = router;
