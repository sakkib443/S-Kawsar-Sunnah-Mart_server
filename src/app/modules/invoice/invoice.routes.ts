import express from 'express';
import InvoiceController from './invoice.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = express.Router();

// ── Customer / admin invoice ─────────────────────
router.get('/:orderId', authMiddleware, InvoiceController.getInvoice);
router.get('/:orderId/pdf', authMiddleware, InvoiceController.downloadInvoicePdf);

// ── Email customer invoice ───────────────────────
router.post('/:orderId/email', authMiddleware, InvoiceController.emailInvoice);

export const InvoiceRoutes = router;
