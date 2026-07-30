import { User } from '../user/user.model';
import AppError from '../../utils/AppError';
import { ALL_PERMISSIONS } from './role.constants';

// Lean fields returned for staff listings / role updates.
const STAFF_FIELDS = 'firstName lastName email role permissions status avatar createdAt';

const RoleService = {
    // ── List every assignable permission ──
    getPermissions() {
        return ALL_PERMISSIONS;
    },

    // ── List all admin / superadmin staff ──
    async getStaff() {
        return await User.find({ role: { $in: ['admin', 'superadmin'] } })
            .select(STAFF_FIELDS)
            .sort({ createdAt: -1 });
    },

    // ── Set role + permissions on a user ──
    async updateUserRole(
        userId: string,
        payload: { role: string; permissions: string[] }
    ) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');

        // Permissions only carry meaning for admins; clear them otherwise.
        const permissions =
            payload.role === 'admin' ? payload.permissions || [] : [];

        user.role = payload.role as typeof user.role;
        user.permissions = permissions;
        await user.save();

        return await User.findById(userId).select(STAFF_FIELDS);
    },
};

export default RoleService;
