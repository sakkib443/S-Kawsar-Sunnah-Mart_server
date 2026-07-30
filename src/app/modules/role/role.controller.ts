import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import RoleService from './role.service';

const RoleController = {
    // Admin / Superadmin
    getPermissions: catchAsync(async (_req: Request, res: Response) => {
        const permissions = RoleService.getPermissions();
        sendResponse(res, { statusCode: 200, success: true, message: 'Permissions fetched', data: permissions });
    }),

    // Superadmin
    getStaff: catchAsync(async (_req: Request, res: Response) => {
        const staff = await RoleService.getStaff();
        sendResponse(res, { statusCode: 200, success: true, message: 'Staff fetched', data: staff });
    }),

    // Superadmin
    updateUserRole: catchAsync(async (req: Request, res: Response) => {
        const user = await RoleService.updateUserRole(req.params.userId, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'User role updated', data: user });
    }),
};

export default RoleController;
