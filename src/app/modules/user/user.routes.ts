import express from 'express';
import UserController from './user.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { updateUserValidation, addAddressValidation, updateAddressValidation, updateStatusValidation } from './user.validation';

const router = express.Router();

// ── My Profile ─────────────────────────────────────────
router.get('/me', authMiddleware, UserController.getMyProfile);
router.patch('/me', authMiddleware, validateRequest(updateUserValidation), UserController.updateMyProfile);

// ── Shipping Addresses ─────────────────────────────────
router.get('/addresses', authMiddleware, UserController.getMyAddresses);
router.post('/addresses', authMiddleware, validateRequest(addAddressValidation), UserController.addShippingAddress);
router.patch('/addresses/:addressId', authMiddleware, validateRequest(updateAddressValidation), UserController.updateShippingAddress);
router.delete('/addresses/:addressId', authMiddleware, UserController.deleteShippingAddress);

// ── Wishlist ───────────────────────────────────────────
// Public read-only shared wishlist (must stay BEFORE auth-protected wishlist routes)
router.get('/wishlist/shared/:userId', UserController.getSharedWishlist);

router.get('/wishlist', authMiddleware, UserController.getWishlist);
router.post('/wishlist', authMiddleware, UserController.toggleWishlistFromBody);
router.post('/wishlist/merge', authMiddleware, UserController.mergeWishlist);
router.post('/wishlist/:productId', authMiddleware, UserController.toggleWishlist);

// ── Admin Routes ────────────────────────────────────────
router.get('/admin/all', authMiddleware, authorizeRoles('admin'), UserController.getAllUsers);
router.get('/admin/stats', authMiddleware, authorizeRoles('admin'), UserController.getAdminStats);
router.get('/admin/:id', authMiddleware, authorizeRoles('admin'), UserController.getUserById);
router.patch('/admin/:id', authMiddleware, authorizeRoles('admin'), UserController.adminUpdateUser);
router.patch('/admin/:id/status', authMiddleware, authorizeRoles('admin'), validateRequest(updateStatusValidation), UserController.updateUserStatus);
router.delete('/admin/:id', authMiddleware, authorizeRoles('admin'), UserController.deleteUser);

export const UserRoutes = router;
