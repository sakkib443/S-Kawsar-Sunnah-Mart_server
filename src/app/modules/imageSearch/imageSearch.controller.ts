import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../utils/AppError';
import ImageSearchService from './imageSearch.service';

const ImageSearchController = {
    // GET /api/image-search/status → whether AI vision is active + which provider.
    status: catchAsync(async (_req: Request, res: Response) => {
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Image search status',
            data: ImageSearchService.getStatus(),
        });
    }),

    // POST /api/image-search
    // body: { colors?: string[], labels?: string[], imageData?: dataURL, limit?: number }
    // The browser extracts real colours from the uploaded image; imageData (a small
    // downscaled data URL) is only forwarded to the AI provider when one is configured.
    search: catchAsync(async (req: Request, res: Response) => {
        const { colors, labels, imageData, limit } = req.body || {};
        const hasColors = Array.isArray(colors) && colors.length > 0;
        const hasLabels = Array.isArray(labels) && labels.length > 0;
        if (!hasColors && !hasLabels && !imageData) {
            throw new AppError(400, 'Provide image colours/labels or image data to search by image');
        }

        const analysis = await ImageSearchService.analyze({ colors, labels, imageData });
        const safeLimit = Math.min(Number(limit) || 24, 48);
        const { products, matchedCount } = await ImageSearchService.search(analysis, safeLimit);

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Image search results',
            data: {
                products,
                detected: { colors: analysis.colors, labels: analysis.labels },
                source: analysis.source,       // 'ai' | 'smart'
                provider: analysis.provider,   // provider id when AI ran
                matchedCount,
            },
        });
    }),
};

export default ImageSearchController;
