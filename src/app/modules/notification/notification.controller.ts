import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../utils/AppError';
import NotificationService from './notification.service';

const requireUser = (req: Request) => {
    if (!req.user) throw new AppError(401, 'You are not logged in.');
    return req.user;
};

const NotificationController = {
    getMy: catchAsync(async (req: Request, res: Response) => {
        const user = requireUser(req);
        const { notifications, unreadCount, meta } = await NotificationService.getMy(
            user.userId,
            req.query as Record<string, unknown>
        );
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Notifications fetched',
            data: { notifications, unreadCount },
            meta,
        });
    }),

    getUnreadCount: catchAsync(async (req: Request, res: Response) => {
        const user = requireUser(req);
        const result = await NotificationService.getUnreadCount(user.userId);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Unread count fetched',
            data: result,
        });
    }),

    markRead: catchAsync(async (req: Request, res: Response) => {
        const user = requireUser(req);
        const notif = await NotificationService.markRead(req.params.id, user.userId);
        if (!notif) throw new AppError(404, 'Notification not found');
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Notification marked as read',
            data: notif,
        });
    }),

    markAllRead: catchAsync(async (req: Request, res: Response) => {
        const user = requireUser(req);
        const result = await NotificationService.markAllRead(user.userId);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'All notifications marked as read',
            data: result,
        });
    }),
};

export default NotificationController;
