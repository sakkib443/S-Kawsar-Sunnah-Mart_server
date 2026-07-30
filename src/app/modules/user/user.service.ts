import { User } from './user.model';
import { Product } from '../product/product.model';
import { Order } from '../order/order.model';
import AppError from '../../utils/AppError';
import QueryBuilder from '../../utils/QueryBuilder';

const UserService = {
    // Get all users (admin)
    async getAllUsers(query: Record<string, unknown>) {
        const userQuery = new QueryBuilder(
            User.find().select('-password'),
            query
        )
            .search(['firstName', 'lastName', 'email', 'phone'])
            .filter()
            .sort()
            .paginate();

        const users = await userQuery.modelQuery;
        const meta = await userQuery.countTotal();
        return { users, meta };
    },

    // Admin stats
    async getAdminStats() {
        const [total, active, blocked, admins] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ status: 'active' }),
            User.countDocuments({ status: 'blocked' }),
            User.countDocuments({ role: 'admin' }),
        ]);

        const newUsersThisMonth = await User.countDocuments({
            createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        });

        return { total, active, blocked, admins, users: total - admins, newUsersThisMonth };
    },

    // Get single user
    async getUserById(id: string) {
        const user = await User.findById(id);
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },

    // Get my profile
    async getMyProfile(userId: string) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },

    // Update my profile
    async updateMyProfile(userId: string, payload: any) {
        // If password change is requested
        if (payload.currentPassword && payload.password) {
            const user = await User.findById(userId).select('+password');
            if (!user) throw new AppError(404, 'User not found');

            const isMatch = await user.comparePassword(payload.currentPassword);
            if (!isMatch) throw new AppError(400, 'Current password is incorrect');

            user.password = payload.password;
            await user.save();
            return user;
        }

        // Normal profile update
        const allowedFields: Record<string, any> = {};
        const allowed = ['firstName', 'lastName', 'phone', 'avatar', 'name'];
        for (const key of allowed) {
            if (payload[key] !== undefined) {
                // Map 'name' to firstName/lastName
                if (key === 'name' && typeof payload.name === 'string') {
                    const parts = payload.name.trim().split(' ');
                    allowedFields.firstName = parts[0];
                    allowedFields.lastName = parts.slice(1).join(' ') || '';
                } else {
                    allowedFields[key] = payload[key];
                }
            }
        }

        const user = await User.findByIdAndUpdate(userId, allowedFields, { new: true, runValidators: true });
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },

    // Admin: update user
    async adminUpdateUser(id: string, payload: any) {
        const allowedFields: Record<string, any> = {};
        // SECURITY: 'role' & 'permissions' are intentionally NOT updatable here.
        // Changing a user's role is a SUPERADMIN-only action handled exclusively by the
        // role module (PATCH /api/roles/:userId). This prevents a regular admin from
        // promoting anyone (including themselves) to admin/superadmin.
        const allowed = ['firstName', 'lastName', 'phone', 'status', 'isEmailVerified'];
        for (const key of allowed) {
            if (payload[key] !== undefined) allowedFields[key] = payload[key];
        }
        const user = await User.findByIdAndUpdate(id, allowedFields, { new: true, runValidators: true });
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },

    // Get my addresses
    async getMyAddresses(userId: string) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');
        return user.shippingAddresses;
    },

    // Add shipping address
    async addShippingAddress(userId: string, address: any) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');

        // If new address is default, remove default from others
        if (address.isDefault) {
            user.shippingAddresses.forEach((addr) => (addr.isDefault = false));
        }

        // Map 'zipCode' to 'postalCode' if sent from frontend
        if (address.zipCode && !address.postalCode) {
            address.postalCode = address.zipCode;
        }

        user.shippingAddresses.push(address);
        await user.save();
        return user.shippingAddresses;
    },

    // Update shipping address
    async updateShippingAddress(userId: string, addressId: string, payload: any) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');

        const address = (user.shippingAddresses as any).id(addressId);
        if (!address) throw new AppError(404, 'Address not found');

        if (payload.isDefault) {
            user.shippingAddresses.forEach((addr) => (addr.isDefault = false));
        }

        // Map zipCode to postalCode
        if (payload.zipCode && !payload.postalCode) {
            payload.postalCode = payload.zipCode;
        }

        Object.assign(address, payload);
        await user.save();
        return user.shippingAddresses;
    },

    // Delete shipping address
    async deleteShippingAddress(userId: string, addressId: string) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');
        user.shippingAddresses = user.shippingAddresses.filter(
            (addr: any) => addr._id?.toString() !== addressId
        );
        await user.save();
        return user.shippingAddresses;
    },

    // Get wishlist (populated with products)
    async getWishlist(userId: string) {
        const user = await User.findById(userId).populate({
            path: 'wishlist',
            // Use the real Product field names (thumbnail/originalPrice/rating/reviewCount)
            // so the wishlist page can render image, price + rating correctly.
            select: 'name slug thumbnail images price originalPrice discount stock rating reviewCount',
            match: { isDeleted: false },
        });
        if (!user) throw new AppError(404, 'User not found');
        return user.wishlist;
    },

    // Toggle wishlist
    async toggleWishlist(userId: string, productId: string) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');

        const index = user.wishlist.indexOf(productId);
        if (index === -1) {
            user.wishlist.push(productId);
        } else {
            user.wishlist.splice(index, 1);
        }
        await user.save();
        return { wishlist: user.wishlist, added: index === -1 };
    },

    // Get a user's wishlist publicly (read-only share). Exposes only product data.
    async getSharedWishlist(userId: string) {
        const user = await User.findById(userId)
            .select('wishlist firstName lastName')
            .populate({
                path: 'wishlist',
                // Real Product field names (thumbnail/originalPrice/rating/reviewCount).
                select: 'name slug thumbnail images price originalPrice discount stock rating reviewCount',
                match: { isDeleted: false },
            });
        if (!user) throw new AppError(404, 'Wishlist not found');
        return user.wishlist;
    },

    // Merge a guest's local wishlist into the logged-in user's wishlist (no duplicates)
    async mergeWishlist(userId: string, productIds: string[]) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');

        const existing = new Set(user.wishlist.map((id) => id.toString()));
        for (const productId of productIds) {
            if (!existing.has(productId)) {
                user.wishlist.push(productId);
                existing.add(productId);
            }
        }
        await user.save();

        return await this.getWishlist(userId);
    },

    // Admin: update user status
    async updateUserStatus(id: string, status: 'active' | 'blocked' | 'pending') {
        const user = await User.findByIdAndUpdate(id, { status }, { new: true });
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },

    // Admin: delete user (soft)
    async deleteUser(id: string) {
        const user = await User.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },
};

export default UserService;
