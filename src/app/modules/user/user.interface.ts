import { Document, Model } from 'mongoose';

export interface IShippingAddress {
    label: string;
    fullName: string;
    phone: string;
    address: string;
    area: string;
    city: string;
    postalCode: string;
    isDefault: boolean;
}

export interface IUser extends Document {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatar: string;
    role: 'superadmin' | 'admin' | 'user';
    permissions: string[];
    status: 'active' | 'blocked' | 'pending';
    isEmailVerified: boolean;
    isDeleted: boolean;

    // Addresses
    shippingAddresses: IShippingAddress[];

    // Stats
    totalOrders: number;
    totalSpent: number;

    // Wishlist
    wishlist: string[];

    // Password reset
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    passwordChangedAt?: Date;

    // Email verification
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;

    // Email OTP
    otpCode?: string;
    otpExpires?: Date;
    otpPurpose?: string;

    // Methods
    comparePassword(candidatePassword: string): Promise<boolean>;
    isPasswordChangedAfterJwtIssued(jwtTimestamp: number): boolean;
}

export interface IUserMethods {
    comparePassword(candidatePassword: string): Promise<boolean>;
    isPasswordChangedAfterJwtIssued(jwtTimestamp: number): boolean;
}

export interface UserModel extends Model<IUser, object, IUserMethods> {
    findByEmail(email: string): Promise<IUser | null>;
    isUserExists(email: string): Promise<boolean>;
}
