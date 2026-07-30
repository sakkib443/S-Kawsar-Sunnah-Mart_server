import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import InquiryService from './inquiry.service';

const InquiryController = {
    create: catchAsync(async (req: Request, res: Response) => {
        const inquiry = await InquiryService.create(req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Inquiry submitted successfully', data: inquiry });
    }),

    getAll: catchAsync(async (req: Request, res: Response) => {
        const { inquiries, meta } = await InquiryService.getAll(req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'Inquiries fetched', data: inquiries, meta });
    }),

    getByProduct: catchAsync(async (req: Request, res: Response) => {
        const inquiries = await InquiryService.getByProduct(req.params.productId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Product inquiries fetched', data: inquiries });
    }),

    updateStatus: catchAsync(async (req: Request, res: Response) => {
        const inquiry = await InquiryService.updateStatus(req.params.id, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Inquiry updated', data: inquiry });
    }),

    delete: catchAsync(async (req: Request, res: Response) => {
        await InquiryService.delete(req.params.id);
        sendResponse(res, { statusCode: 200, success: true, message: 'Inquiry deleted' });
    }),
};

export default InquiryController;
