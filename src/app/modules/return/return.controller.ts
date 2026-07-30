import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import ReturnService from './return.service';

const ReturnController = {
    // ── Customer ───────────────────────────────────────────────────
    create: catchAsync(async (req: Request, res: Response) => {
        const doc = await ReturnService.createReturn(req.user!.userId, req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Return request submitted', data: doc });
    }),

    getMyReturns: catchAsync(async (req: Request, res: Response) => {
        const data = await ReturnService.getMyReturns(req.user!.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'My returns fetched', data });
    }),

    getById: catchAsync(async (req: Request, res: Response) => {
        const doc = await ReturnService.getReturnById(req.params.id, {
            userId: req.user!.userId,
            role: req.user!.role,
        });
        sendResponse(res, { statusCode: 200, success: true, message: 'Return request fetched', data: doc });
    }),

    // ── Admin ──────────────────────────────────────────────────────
    getAll: catchAsync(async (req: Request, res: Response) => {
        const data = await ReturnService.getAllReturns(req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'Returns fetched', data });
    }),

    adminApprove: catchAsync(async (req: Request, res: Response) => {
        const doc = await ReturnService.approveReturn(req.params.id, { userId: req.user!.userId }, req.body.note);
        sendResponse(res, { statusCode: 200, success: true, message: 'Return approved', data: doc });
    }),

    adminReject: catchAsync(async (req: Request, res: Response) => {
        const doc = await ReturnService.rejectReturn(req.params.id, { userId: req.user!.userId }, req.body.rejectionReason);
        sendResponse(res, { statusCode: 200, success: true, message: 'Return rejected', data: doc });
    }),

    adminRefund: catchAsync(async (req: Request, res: Response) => {
        const doc = await ReturnService.refundReturn(req.params.id, { userId: req.user!.userId }, req.body.note);
        sendResponse(res, { statusCode: 200, success: true, message: 'Refund processed', data: doc });
    }),

};

export default ReturnController;
