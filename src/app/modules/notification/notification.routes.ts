import express from 'express';
import NotificationController from './notification.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = express.Router();

// Every notification route is for the logged-in user.
router.use(authMiddleware);

router.get('/', NotificationController.getMy);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/read-all', NotificationController.markAllRead);
router.patch('/:id/read', NotificationController.markRead);

export const NotificationRoutes = router;
