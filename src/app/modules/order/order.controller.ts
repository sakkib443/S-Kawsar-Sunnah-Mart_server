import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import OrderService from './order.service';

const OrderController = {
    getAll: catchAsync(async (req: Request, res: Response) => {
        const { orders, meta } = await OrderService.getAllOrders(req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'Orders fetched', data: orders, meta });
    }),

    getMyOrders: catchAsync(async (req: Request, res: Response) => {
        const { orders, meta } = await OrderService.getMyOrders(req.user!.userId, req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'My orders fetched', data: orders, meta });
    }),

    getById: catchAsync(async (req: Request, res: Response) => {
        // Admin AND super admin can view any order; everyone else is scoped to their own.
        const isAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
        const order = await OrderService.getOrderById(req.params.id, isAdmin ? undefined : req.user!.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Order fetched', data: order });
    }),

    create: catchAsync(async (req: Request, res: Response) => {
        const order = await OrderService.createOrder(req.user!.userId, req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Order placed successfully', data: order });
    }),

    updateStatus: catchAsync(async (req: Request, res: Response) => {
        const order = await OrderService.updateOrderStatus(req.params.id, req.body.status, req.body.note);
        sendResponse(res, { statusCode: 200, success: true, message: 'Order status updated', data: order });
    }),

    updatePaymentStatus: catchAsync(async (req: Request, res: Response) => {
        const order = await OrderService.updatePaymentStatus(req.params.id, req.body.paymentStatus);
        sendResponse(res, { statusCode: 200, success: true, message: 'Payment status updated', data: order });
    }),

    addNote: catchAsync(async (req: Request, res: Response) => {
        const order = await OrderService.addAdminNote(req.params.id, req.body.note);
        sendResponse(res, { statusCode: 200, success: true, message: 'Note added', data: order });
    }),

    updateOrderTracking: catchAsync(async (req: Request, res: Response) => {
        const order = await OrderService.updateOrderTracking(req.params.id, req.body.trackingNumber, req.body.carrier);
        sendResponse(res, { statusCode: 200, success: true, message: 'Order tracking updated', data: order });
    }),

    // Public order tracking (no auth)
    trackOrder: catchAsync(async (req: Request, res: Response) => {
        const data = await OrderService.trackOrder(req.params.orderId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Order tracking fetched', data });
    }),

    cancel: catchAsync(async (req: Request, res: Response) => {
        const order = await OrderService.cancelOrder(req.params.id, req.user!.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Order cancelled', data: order });
    }),

    getStats: catchAsync(async (req: Request, res: Response) => {
        const stats = await OrderService.getOrderStats();
        sendResponse(res, { statusCode: 200, success: true, message: 'Order stats fetched', data: stats });
    }),

    guestCheckout: catchAsync(async (req: Request, res: Response) => {
        const result = await OrderService.createGuestOrder(req.body);
        const message = result.isNewUser
            ? 'Order placed successfully! An account has been created for you. Your phone number is your password.'
            : 'Order placed successfully!';
        sendResponse(res, { statusCode: 201, success: true, message, data: result });
    }),
};

export default OrderController;
