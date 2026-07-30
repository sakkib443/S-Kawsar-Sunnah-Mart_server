import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../utils/AppError';
import UserService from './user.service';

const UserController = {
    // GET /api/users/admin/all (admin)
    getAllUsers: catchAsync(async (req: Request, res: Response) => {
        const { users, meta } = await UserService.getAllUsers(req.query as Record<string, unknown>);
        sendResponse(res, { statusCode: 200, success: true, message: 'Users fetched successfully', data: users, meta });
    }),

    // GET /api/users/admin/stats (admin)
    getAdminStats: catchAsync(async (req: Request, res: Response) => {
        const stats = await UserService.getAdminStats();
        sendResponse(res, { statusCode: 200, success: true, message: 'User stats fetched', data: stats });
    }),

    // GET /api/users/me
    getMyProfile: catchAsync(async (req: Request, res: Response) => {
        const user = await UserService.getMyProfile(req.user!.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Profile fetched successfully', data: user });
    }),

    // PATCH /api/users/me
    updateMyProfile: catchAsync(async (req: Request, res: Response) => {
        const user = await UserService.updateMyProfile(req.user!.userId, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Profile updated successfully', data: user });
    }),

    // GET /api/users/admin/:id (admin)
    getUserById: catchAsync(async (req: Request, res: Response) => {
        const user = await UserService.getUserById(req.params.id);
        sendResponse(res, { statusCode: 200, success: true, message: 'User fetched successfully', data: user });
    }),

    // PATCH /api/users/admin/:id (admin)
    adminUpdateUser: catchAsync(async (req: Request, res: Response) => {
        const user = await UserService.adminUpdateUser(req.params.id, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'User updated successfully', data: user });
    }),

    // GET /api/users/addresses
    getMyAddresses: catchAsync(async (req: Request, res: Response) => {
        const addresses = await UserService.getMyAddresses(req.user!.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Addresses fetched', data: addresses });
    }),

    // POST /api/users/addresses
    addShippingAddress: catchAsync(async (req: Request, res: Response) => {
        const addresses = await UserService.addShippingAddress(req.user!.userId, req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Address added successfully', data: addresses });
    }),

    // PATCH /api/users/addresses/:addressId
    updateShippingAddress: catchAsync(async (req: Request, res: Response) => {
        const addresses = await UserService.updateShippingAddress(req.user!.userId, req.params.addressId, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Address updated successfully', data: addresses });
    }),

    // DELETE /api/users/addresses/:addressId
    deleteShippingAddress: catchAsync(async (req: Request, res: Response) => {
        const addresses = await UserService.deleteShippingAddress(req.user!.userId, req.params.addressId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Address deleted successfully', data: addresses });
    }),

    // GET /api/users/wishlist
    getWishlist: catchAsync(async (req: Request, res: Response) => {
        const wishlist = await UserService.getWishlist(req.user!.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Wishlist fetched', data: wishlist });
    }),

    // POST /api/users/wishlist/:productId (legacy)
    toggleWishlist: catchAsync(async (req: Request, res: Response) => {
        const result = await UserService.toggleWishlist(req.user!.userId, req.params.productId);
        sendResponse(res, { statusCode: 200, success: true, message: result.added ? 'Added to wishlist' : 'Removed from wishlist', data: result });
    }),

    // POST /api/users/wishlist (from body)
    toggleWishlistFromBody: catchAsync(async (req: Request, res: Response) => {
        const { productId } = req.body;
        const result = await UserService.toggleWishlist(req.user!.userId, productId);
        sendResponse(res, { statusCode: 200, success: true, message: result.added ? 'Added to wishlist' : 'Removed from wishlist', data: result });
    }),

    // GET /api/users/wishlist/shared/:userId (public, read-only)
    getSharedWishlist: catchAsync(async (req: Request, res: Response) => {
        const wishlist = await UserService.getSharedWishlist(req.params.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Shared wishlist fetched', data: wishlist });
    }),

    // POST /api/users/wishlist/merge (auth) — merge guest local wishlist on login
    mergeWishlist: catchAsync(async (req: Request, res: Response) => {
        const { productIds } = req.body;
        if (!Array.isArray(productIds) || !productIds.every((id) => typeof id === 'string')) {
            throw new AppError(400, 'productIds must be an array of strings');
        }
        const wishlist = await UserService.mergeWishlist(req.user!.userId, productIds);
        sendResponse(res, { statusCode: 200, success: true, message: 'Wishlist merged', data: wishlist });
    }),

    // PATCH /api/users/admin/:id/status (admin)
    updateUserStatus: catchAsync(async (req: Request, res: Response) => {
        const user = await UserService.updateUserStatus(req.params.id, req.body.status);
        sendResponse(res, { statusCode: 200, success: true, message: 'User status updated', data: user });
    }),

    // DELETE /api/users/admin/:id (admin)
    deleteUser: catchAsync(async (req: Request, res: Response) => {
        await UserService.deleteUser(req.params.id);
        sendResponse(res, { statusCode: 200, success: true, message: 'User deleted successfully' });
    }),
};

export default UserController;
