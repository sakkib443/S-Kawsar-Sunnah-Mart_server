import express from 'express';
import NewsletterController from './newsletter.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';

const router = express.Router();

// PUBLIC — no auth.
router.post('/subscribe', NewsletterController.subscribe);

// ADMIN — list subscribers.
router.get('/', authMiddleware, authorizeRoles('admin', 'superadmin'), NewsletterController.getAll);

export const NewsletterRoutes = router;
