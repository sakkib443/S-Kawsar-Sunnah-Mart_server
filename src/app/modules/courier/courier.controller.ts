import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import CourierService from './courier.service';
import config from '../../config';

const CourierController = {
    // GET /api/courier/orders?state=&search=&page=&limit=
    listOrders: catchAsync(async (req: Request, res: Response) => {
        const { state, search, page, limit } = req.query;
        const result = await CourierService.listOrders({
            state: state as string,
            search: search as string,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Courier orders fetched',
            meta: result.meta,
            data: result.data,
        });
    }),

    // POST /api/courier/orders/:orderId/book
    bookOrder: catchAsync(async (req: Request, res: Response) => {
        const order = await CourierService.bookOrder(req.params.orderId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Order booked with Steadfast', data: order });
    }),

    // POST /api/courier/bulk-book   body: { orderIds: [] }
    bulkBook: catchAsync(async (req: Request, res: Response) => {
        const result = await CourierService.bulkBook(req.body?.orderIds || []);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: `Booked ${result.booked}/${result.total} order(s) with Steadfast`,
            data: result,
        });
    }),

    // GET /api/courier/orders/:orderId/status
    refreshStatus: catchAsync(async (req: Request, res: Response) => {
        const result = await CourierService.refreshStatus(req.params.orderId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Courier status refreshed', data: result });
    }),

    // POST /api/courier/bulk-status   body: { orderIds: [] }
    bulkRefresh: catchAsync(async (req: Request, res: Response) => {
        const result = await CourierService.bulkRefresh(req.body?.orderIds || []);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: `Synced ${result.ok}/${result.total} order(s)`,
            data: result,
        });
    }),

    // GET /api/courier/balance
    getBalance: catchAsync(async (_req: Request, res: Response) => {
        const balance = await CourierService.getBalance();
        sendResponse(res, { statusCode: 200, success: true, message: 'Steadfast balance fetched', data: balance });
    }),

    // POST /api/courier/webhook  (public — Steadfast calls this; guarded by shared secret)
    webhook: catchAsync(async (req: Request, res: Response) => {
        const secret = config.steadfast.webhook_secret;
        if (secret) {
            const provided = (req.query.secret as string) || (req.headers['x-webhook-secret'] as string) || '';
            if (provided !== secret) {
                return sendResponse(res, { statusCode: 401, success: false, message: 'Invalid webhook secret', data: null });
            }
        }
        const result = await CourierService.applyWebhook(req.body || {});
        sendResponse(res, { statusCode: 200, success: true, message: 'Webhook processed', data: result });
    }),
};

export default CourierController;
