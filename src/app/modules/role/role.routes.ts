import express from 'express';
import RoleController from './role.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { updateUserRoleValidation } from './role.validation';

const router = express.Router();

// ── Permission catalogue (admin + superadmin, read-only) ──
router.get('/permissions', authMiddleware, authorizeRoles('admin', 'superadmin'), RoleController.getPermissions);

// ── Staff management (superadmin only) ──
router.get('/staff', authMiddleware, authorizeRoles('superadmin'), RoleController.getStaff);
router.patch(
    '/:userId',
    authMiddleware,
    authorizeRoles('superadmin'),
    validateRequest(updateUserRoleValidation),
    RoleController.updateUserRole
);

export const RoleRoutes = router;
