import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import InvoiceService from './invoice.service';

const InvoiceController = {
    getInvoice: catchAsync(async (req: Request, res: Response) => {
        const data = await InvoiceService.getInvoiceData(req.params.orderId, {
            userId: req.user!.userId,
            role: req.user!.role,
        });
        sendResponse(res, { statusCode: 200, success: true, message: 'Invoice fetched', data });
    }),

    downloadInvoicePdf: catchAsync(async (req: Request, res: Response) => {
        const pdf = await InvoiceService.getInvoicePdf(req.params.orderId, {
            userId: req.user!.userId,
            role: req.user!.role,
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice-${req.params.orderId}.pdf"`);
        res.send(pdf);
    }),

    emailInvoice: catchAsync(async (req: Request, res: Response) => {
        // Auth scope: customer (own order) or admin. Reuse the scoped fetch which
        // throws 403/404 for anyone else before we trigger the email.
        await InvoiceService.getInvoiceData(req.params.orderId, {
            userId: req.user!.userId,
            role: req.user!.role,
        });
        await InvoiceService.emailInvoiceToCustomer(req.params.orderId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Invoice email sent' });
    }),
};

export default InvoiceController;
