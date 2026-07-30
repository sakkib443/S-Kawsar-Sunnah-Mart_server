import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import NewsletterService from './newsletter.service';

const NewsletterController = {
    // PUBLIC — storefront footer subscribe.
    subscribe: catchAsync(async (req: Request, res: Response) => {
        await NewsletterService.subscribe(req.body.email);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Thanks for subscribing to S Kawsar Sunnah Mart!',
        });
    }),

    // ADMIN — list subscribers.
    getAll: catchAsync(async (req: Request, res: Response) => {
        const { subscribers, meta } = await NewsletterService.getAll(req.query as Record<string, unknown>);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Subscribers fetched',
            data: subscribers,
            meta,
        });
    }),
};

export default NewsletterController;
