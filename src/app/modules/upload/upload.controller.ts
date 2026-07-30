import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { fileToUrl } from '../../utils/cloudinary';

// POST /api/upload/image   — single image
// POST /api/upload/images  — multiple images (max 10)

export const uploadController = {
    // ── Single image ──────────────────────────────────────────
    uploadSingle: catchAsync(async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const url = fileToUrl(req, req.file as Express.Multer.File); // works for Cloudinary + local disk
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Image uploaded successfully',
            data: { url },
        });
    }),

    // ── Multiple images (up to 10) ────────────────────────────
    uploadMultiple: catchAsync(async (req: Request, res: Response) => {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }
        const urls = files.map((f) => fileToUrl(req, f));
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: `${urls.length} image(s) uploaded successfully`,
            data: { urls },
        });
    }),
};
