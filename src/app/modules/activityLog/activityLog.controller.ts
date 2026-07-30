import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import ActivityLogService from './activityLog.service';

const ActivityLogController = {
    getAll: catchAsync(async (req: Request, res: Response) => {
        const { logs, meta } = await ActivityLogService.getAll(req.query as Record<string, unknown>);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Activity logs fetched',
            data: logs,
            meta,
        });
    }),
};

export default ActivityLogController;
