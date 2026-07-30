import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../../config';
import { IUser, IUserMethods, UserModel } from './user.interface';

const shippingAddressSchema = new Schema({
    label: { type: String, default: 'Home' },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    area: { type: String, default: '' },
    city: { type: String, required: true },
    postalCode: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
    {
        // ── Basic Info ──────────────────────────────
        email: {
            type: String, required: [true, 'Email is required'], unique: true,
            lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        password: {
            type: String, required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'], select: false,
        },
        firstName: { type: String, required: [true, 'First name is required'], trim: true, maxlength: 50 },
        lastName: { type: String, required: [true, 'Last name is required'], trim: true, maxlength: 50 },
        phone: { type: String, trim: true, default: '' },
        avatar: { type: String, default: '' },

        // ── Role & Status ────────────────────────────
        role: {
            type: String,
            enum: { values: ['superadmin', 'admin', 'user'], message: '{VALUE} is not a valid role' },
            default: 'user',
        },
        permissions: { type: [String], default: [] },
        status: {
            type: String,
            enum: { values: ['active', 'blocked', 'pending'], message: '{VALUE} is not a valid status' },
            default: 'active',
        },
        isEmailVerified: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },

        // ── Shipping Addresses ───────────────────────
        shippingAddresses: { type: [shippingAddressSchema], default: [] },

        // ── Wishlist ─────────────────────────────────
        wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],

        // ── Stats ────────────────────────────────────
        totalOrders: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },

        // ── Password Reset ───────────────────────────
        passwordResetToken: String,
        passwordResetExpires: Date,
        passwordChangedAt: Date,

        // ── Email Verification ───────────────────────
        emailVerificationToken: { type: String, select: false },
        emailVerificationExpires: Date,

        // ── Email OTP ────────────────────────────────
        otpCode: { type: String, select: false },
        otpExpires: Date,
        otpPurpose: String,
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                delete ret.password;
                delete ret.__v;
                return ret;
            },
        },
    }
);

// ── Indexes ──────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ role: 1, status: 1 });

// ── Virtuals ─────────────────────────────────────
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// ── Pre-save: Hash password ───────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, config.bcrypt_salt_rounds);
    if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
    next();
});

// ── Pre-find: Exclude deleted ─────────────────────
userSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});
userSchema.pre('findOne', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

// ── Instance Methods ──────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isPasswordChangedAfterJwtIssued = function (jwtTimestamp: number): boolean {
    if (this.passwordChangedAt) {
        const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
        return jwtTimestamp < changedTimestamp;
    }
    return false;
};

// ── Static Methods ────────────────────────────────
userSchema.statics.findByEmail = async function (email: string) {
    return await this.findOne({ email }).select('+password');
};

userSchema.statics.isUserExists = async function (email: string) {
    const user = await this.findOne({ email });
    return !!user;
};

export const User = model<IUser, UserModel>('User', userSchema);
