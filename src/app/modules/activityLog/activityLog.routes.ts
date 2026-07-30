import express from 'express';
import ActivityLogController from './activityLog.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';

const router = express.Router();

// Admin-only: view the activity log feed.
router.get('/', authMiddleware, authorizeRoles('admin', 'superadmin'), ActivityLogController.getAll);

export const ActivityLogRoutes = router;
