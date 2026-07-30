import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import OfferService from './offer.service';

const OfferController = {
    // Public
    getActive: catchAsync(async (req: Request, res: Response) => {
        const type = req.query.type as string | undefined;
        const offers = await OfferService.getActive(type);
        sendResponse(res, { statusCode: 200, success: true, message: 'Active offers fetched', data: offers });
    }),

    // Admin
    getAll: catchAsync(async (_req: Request, res: Response) => {
        const offers = await OfferService.getAll();
        sendResponse(res, { statusCode: 200, success: true, message: 'Offers fetched', data: offers });
    }),
    getById: catchAsync(async (req: Request, res: Response) => {
        const offer = await OfferService.getById(req.params.id);
        sendResponse(res, { statusCode: 200, success: true, message: 'Offer fetched', data: offer });
    }),
    create: catchAsync(async (req: Request, res: Response) => {
        const offer = await OfferService.create(req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Offer created', data: offer });
    }),
    update: catchAsync(async (req: Request, res: Response) => {
        const offer = await OfferService.update(req.params.id, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Offer updated', data: offer });
    }),
    delete: catchAsync(async (req: Request, res: Response) => {
        await OfferService.delete(req.params.id);
        sendResponse(res, { statusCode: 200, success: true, message: 'Offer deleted' });
    }),
};

export default OfferController;
