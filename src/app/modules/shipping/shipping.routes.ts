import express from 'express';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import ShippingController from './shipping.controller';

const router = express.Router();

// ── PUBLIC ─────────────────────────────────────────
// Shipping quote + live settings for checkout — MUST stay above the admin guard.
router.get('/quote', ShippingController.getQuote);
router.get('/settings', ShippingController.getSettings);

// All shipping routes below require admin auth
router.use(authMiddleware, authorizeRoles('admin'));

// Settings (admin update)
router.patch('/settings', ShippingController.updateSettings);

// Zones
router.get('/zones', ShippingController.getZones);
router.post('/zones', ShippingController.createZone);
router.patch('/zones/:id', ShippingController.updateZone);
router.delete('/zones/:id', ShippingController.deleteZone);

// Rates
router.get('/rates', ShippingController.getRates);
router.post('/rates', ShippingController.createRate);
router.patch('/rates/:id', ShippingController.updateRate);
router.delete('/rates/:id', ShippingController.deleteRate);

// Shipments (from orders)
router.get('/shipments', ShippingController.getShipments);
router.get('/stats', ShippingController.getStats);
router.patch('/shipments/:id/status', ShippingController.updateShipmentStatus);

export const ShippingRoutes = router;
