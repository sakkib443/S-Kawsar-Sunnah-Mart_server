import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../utils/AppError';
import config from '../../config';
import { PaymentService } from './payment.service';

const frontend = (): string => config.payment.frontend_url.replace(/\/+$/, '');

const PaymentController = {
    // ── PUBLIC: GET /payments/methods ────────────────────────────────
    // What checkout may offer and how each method collects money
    // (gateway / manual send-money / cash on delivery).
    methods: catchAsync(async (_req: Request, res: Response) => {
        const data = await PaymentService.getAvailableMethods();
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Payment methods fetched',
            data,
        });
    }),

    // ── PUBLIC: POST /payments/init ──────────────────────────────────
    init: catchAsync(async (req: Request, res: Response) => {
        const { orderId, method } = req.body;
        const result = await PaymentService.initPayment({ orderId, method });
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Payment initialized',
            data: result,
        });
    }),

    // ── PUBLIC: SSLCommerz callbacks (browser/gateway redirects) ─────
    // success/fail/cancel redirect the browser back to the frontend.
    sslcommerzSuccess: catchAsync(async (req: Request, res: Response) => {
        const payload = { ...req.body, ...req.query } as Record<string, any>;
        const { transactionId } = await PaymentService.handleSslcommerzCallback('success', payload);
        res.redirect(`${frontend()}/payment/success?txn=${transactionId}`);
    }),

    sslcommerzFail: catchAsync(async (req: Request, res: Response) => {
        const payload = { ...req.body, ...req.query } as Record<string, any>;
        const { transactionId } = await PaymentService.handleSslcommerzCallback('fail', payload);
        res.redirect(`${frontend()}/payment/fail?txn=${transactionId}`);
    }),

    sslcommerzCancel: catchAsync(async (req: Request, res: Response) => {
        const payload = { ...req.body, ...req.query } as Record<string, any>;
        const { transactionId } = await PaymentService.handleSslcommerzCallback('cancel', payload);
        res.redirect(`${frontend()}/payment/cancel?txn=${transactionId}`);
    }),

    // server-to-server IPN: respond JSON, no redirect.
    sslcommerzIpn: catchAsync(async (req: Request, res: Response) => {
        const payload = { ...req.body, ...req.query } as Record<string, any>;
        const result = await PaymentService.handleSslcommerzCallback('ipn', payload);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'IPN processed',
            data: result,
        });
    }),

    // ── PUBLIC: POST /payments/bkash/execute ─────────────────────────
    bkashExecute: catchAsync(async (req: Request, res: Response) => {
        const { paymentID } = req.body;
        const result = await PaymentService.executeBkash(paymentID);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'bKash payment executed',
            data: result,
        });
    }),

    // ── PUBLIC (DEV-SIM): POST /payments/simulate/confirm ────────────
    simulateConfirm: catchAsync(async (req: Request, res: Response) => {
        const { transactionId, outcome } = req.body;
        const result = await PaymentService.confirmSimulated(transactionId, outcome);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Simulated payment processed',
            data: result,
        });
    }),

    // ── PUBLIC: GET /payments/verify/:transactionId ──────────────────
    verify: catchAsync(async (req: Request, res: Response) => {
        const result = await PaymentService.verifyPayment(req.params.transactionId);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Payment verified',
            data: result,
        });
    }),

    // ── AUTH: GET /payments/my (user payment history) ────────────────
    getMyTransactions: catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError(401, 'You are not logged in.');
        const data = await PaymentService.getMyTransactions(req.user.userId);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Payment history fetched',
            data,
        });
    }),

    // ── AUTH: POST /payments/:transactionId/retry (recovery) ─────────
    retry: catchAsync(async (req: Request, res: Response) => {
        const result = await PaymentService.retryPayment(
            req.params.transactionId,
            req.user?.userId
        );
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Payment retry initialized',
            data: result,
        });
    }),

};

export default PaymentController;
