import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import SiteContentService from './siteContent.service';

const SiteContentController = {
    // GET /api/site-content — Public
    get: catchAsync(async (req: Request, res: Response) => {
        const content = await SiteContentService.get();
        sendResponse(res, { statusCode: 200, success: true, message: 'Site content fetched', data: content });
    }),

    // PUT /api/site-content — Admin only (full update)
    update: catchAsync(async (req: Request, res: Response) => {
        const content = await SiteContentService.update(req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Site content updated', data: content });
    }),

    // PATCH /api/site-content/:section — Admin only (section update)
    updateSection: catchAsync(async (req: Request, res: Response) => {
        const { section } = req.params;
        const validSections = ['ticker', 'contact', 'floating', 'footer', 'defaultTagline', 'seo', 'announcement', 'legalPages'];
        if (!validSections.includes(section)) {
            return sendResponse(res, { statusCode: 400, success: false, message: `Invalid section: ${section}` });
        }
        const content = await SiteContentService.updateSection(section, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: `${section} updated`, data: content });
    }),

    // GET /api/site-content/legal/:slug — Public (single legal page)
    getLegalPage: catchAsync(async (req: Request, res: Response) => {
        const { slug } = req.params;
        const validSlugs = ['terms', 'privacy', 'refund'];
        if (!validSlugs.includes(slug)) {
            return sendResponse(res, { statusCode: 400, success: false, message: `Invalid legal page: ${slug}` });
        }
        const page = await SiteContentService.getLegalPage(slug);
        if (!page) {
            return sendResponse(res, { statusCode: 404, success: false, message: 'Legal page not found' });
        }
        sendResponse(res, { statusCode: 200, success: true, message: 'Legal page fetched', data: page });
    }),

    // PUT /api/site-content/legal/:slug — Admin only (update legal page)
    updateLegalPage: catchAsync(async (req: Request, res: Response) => {
        const { slug } = req.params;
        const validSlugs = ['terms', 'privacy', 'refund'];
        if (!validSlugs.includes(slug)) {
            return sendResponse(res, { statusCode: 400, success: false, message: `Invalid legal page: ${slug}` });
        }
        const page = await SiteContentService.updateLegalPage(slug, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Legal page updated', data: page });
    }),

    // GET /api/site-content/legal — Admin (all legal pages)
    getAllLegalPages: catchAsync(async (req: Request, res: Response) => {
        const pages = await SiteContentService.getAllLegalPages();
        sendResponse(res, { statusCode: 200, success: true, message: 'Legal pages fetched', data: pages });
    }),
};

export default SiteContentController;
