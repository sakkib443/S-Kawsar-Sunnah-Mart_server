import express from 'express';
import { authMiddleware } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import PaymentController from './payment.controller';
import {
    initPaymentValidation,
    bkashExecuteValidation,
    simulateConfirmValidation,
} from './payment.validation';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth) — gateways/redirects hit these.
// MUST be declared BEFORE the admin guard below.
// ─────────────────────────────────────────────────────────────────────

// Which methods checkout may offer, and how each one collects money.
router.get('/methods', PaymentController.methods);

// Start a payment for an existing order → { redirectUrl, transactionId }
router.post('/init', validateRequest(initPaymentValidation), PaymentController.init);

// SSLCommerz callbacks (gateway posts form-encoded; some setups use GET).
router.get('/sslcommerz/success', PaymentController.sslcommerzSuccess);
router.post('/sslcommerz/success', PaymentController.sslcommerzSuccess);
router.get('/sslcommerz/fail', PaymentController.sslcommerzFail);
router.post('/sslcommerz/fail', PaymentController.sslcommerzFail);
router.get('/sslcommerz/cancel', PaymentController.sslcommerzCancel);
router.post('/sslcommerz/cancel', PaymentController.sslcommerzCancel);
router.get('/sslcommerz/ipn', PaymentController.sslcommerzIpn);
router.post('/sslcommerz/ipn', PaymentController.sslcommerzIpn);

// bKash execute step.
router.post('/bkash/execute', validateRequest(bkashExecuteValidation), PaymentController.bkashExecute);

// DEV-SIMULATION confirm (called by the frontend /payment/simulate page).
router.post('/simulate/confirm', validateRequest(simulateConfirmValidation), PaymentController.simulateConfirm);

// Public verify.
router.get('/verify/:transactionId', PaymentController.verify);

// ─────────────────────────────────────────────────────────────────────
// AUTHENTICATED USER ROUTES (logged-in, any role) — declared per-route
// so they sit ABOVE the admin guard.
// ─────────────────────────────────────────────────────────────────────
router.get('/my', authMiddleware, PaymentController.getMyTransactions);
router.post('/:transactionId/retry', authMiddleware, PaymentController.retry);

// Admin payment management (list / stats / mark-paid / refund) lives on the
// order + finance modules: /orders/admin/all, /orders/admin/:id/payment (mark
// paid / refund), and /finance/summary — so there are no payment-admin routes here.

export const PaymentRoutes = router;
