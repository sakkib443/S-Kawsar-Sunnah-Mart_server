import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config';
import AppError from '../../utils/AppError';
import { sendEmail } from '../../utils/email';
import { User } from '../user/user.model';
import { IAuthResponse, IJwtPayload, ITokens } from './auth.interface';
import { TLoginInput, TRegisterInput } from './auth.validation';

// ── Helpers ───────────────────────────────────────────────
const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

const buildVerificationEmail = (verifyLink: string): { subject: string; html: string } => ({
    subject: 'Verify your S Kawsar Sunnah Mart email',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
            <h2 style="color: #F85606;">Welcome to S Kawsar Sunnah Mart!</h2>
            <p>Please confirm your email address to activate your account.</p>
            <p style="text-align: center; margin: 28px 0;">
                <a href="${verifyLink}" style="background: #F85606; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block;">Verify Email</a>
            </p>
            <p style="font-size: 13px; color: #666;">Or paste this link into your browser:<br/>${verifyLink}</p>
            <p style="font-size: 12px; color: #999;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
        </div>`,
});

const buildOtpEmail = (otp: string, purpose: string): { subject: string; html: string } => ({
    subject: `Your S Kawsar Sunnah Mart verification code: ${otp}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
            <h2 style="color: #F85606;">Your verification code</h2>
            <p>Use the code below to continue${purpose ? ` (${purpose})` : ''}:</p>
            <p style="text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #F85606; margin: 24px 0;">${otp}</p>
            <p style="font-size: 12px; color: #999;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>`,
});

const buildResetEmail = (resetLink: string): { subject: string; html: string } => ({
    subject: 'Reset your S Kawsar Sunnah Mart password',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
            <h2 style="color: #F85606;">Password reset request</h2>
            <p>We received a request to reset your password. Click the button below to choose a new one.</p>
            <p style="text-align: center; margin: 28px 0;">
                <a href="${resetLink}" style="background: #F85606; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block;">Reset Password</a>
            </p>
            <p style="font-size: 13px; color: #666;">Or paste this link into your browser:<br/>${resetLink}</p>
            <p style="font-size: 12px; color: #999;">This link expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>`,
});

const AuthService = {
    generateTokens(payload: IJwtPayload): ITokens {
        const accessToken = jwt.sign(payload, config.jwt.access_secret, {
            expiresIn: config.jwt.access_expires_in as SignOptions['expiresIn'],
        });
        const refreshToken = jwt.sign(payload, config.jwt.refresh_secret, {
            expiresIn: config.jwt.refresh_expires_in as SignOptions['expiresIn'],
        });
        return { accessToken, refreshToken };
    },

    async register(payload: any): Promise<IAuthResponse & { verifyLink?: string }> {
        const { firstName, lastName, email, phone, password, location } = payload;

        // Auto-generate guest email if only phone provided
        const userEmail = email || `${phone?.replace(/\s+/g, '')}@guest.skawsarsunnahmart.com`;

        const isExists = await User.isUserExists(userEmail);
        if (isExists) throw new AppError(400, 'Account already exists with this email. Please login.');

        // Also check if phone is already registered
        if (phone) {
            const phoneExists = await User.findOne({ phone: phone.trim() });
            if (phoneExists) throw new AppError(400, 'This phone number is already registered. Please login.');
        }

        const user = await User.create({
            firstName,
            lastName: lastName || '.',
            email: userEmail,
            phone: phone || '',
            password,
            location: location || '',
            status: 'active',
            isEmailVerified: false,
        });

        // Generate email-verification token (raw sent to user, hash stored).
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = sha256(rawToken);
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        await user.save({ validateBeforeSave: false });

        const verifyLink = `${config.frontend_url}/verify-email?token=${rawToken}`;
        const { subject, html } = buildVerificationEmail(verifyLink);
        await sendEmail({ to: user.email, subject, html });

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        const tokens = this.generateTokens(jwtPayload);

        return {
            user: { _id: user._id!.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: user.avatar },
            tokens,
            verifyLink, // controller decides whether to expose this (dev mode only)
        };
    },

    async verifyEmail(rawToken: string): Promise<void> {
        const hashedToken = sha256(rawToken);
        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
            isDeleted: false,
        }).select('+emailVerificationToken');

        if (!user) throw new AppError(400, 'Invalid or expired verification link');

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save({ validateBeforeSave: false });
    },

    async resendVerification(email: string): Promise<{ verifyLink: string } | null> {
        const user = await User.findOne({ email, isDeleted: false });
        // No email enumeration — caller always responds success.
        if (!user) return null;
        if (user.isEmailVerified) return null;

        const rawToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = sha256(rawToken);
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        await user.save({ validateBeforeSave: false });

        const verifyLink = `${config.frontend_url}/verify-email?token=${rawToken}`;
        const { subject, html } = buildVerificationEmail(verifyLink);
        await sendEmail({ to: user.email, subject, html });

        return { verifyLink };
    },

    async sendOtp(email: string, purpose: string): Promise<{ otp: string } | null> {
        const user = await User.findOne({ email, isDeleted: false });
        // No email enumeration — caller always responds success.
        if (!user) return null;

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
        user.otpCode = sha256(otp);
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        user.otpPurpose = purpose;
        await user.save({ validateBeforeSave: false });

        const { subject, html } = buildOtpEmail(otp, purpose);
        await sendEmail({ to: user.email, subject, html });

        return { otp };
    },

    async verifyOtp(email: string, code: string, purpose: string): Promise<void> {
        const user = await User.findOne({ email, isDeleted: false }).select('+otpCode');
        if (!user || !user.otpCode || !user.otpExpires) throw new AppError(400, 'Invalid or expired code');

        if (user.otpExpires.getTime() < Date.now()) throw new AppError(400, 'Invalid or expired code');
        if (user.otpPurpose !== purpose) throw new AppError(400, 'Invalid or expired code');
        if (user.otpCode !== sha256(code)) throw new AppError(400, 'Invalid or expired code');

        // Clear OTP on success.
        user.otpCode = undefined;
        user.otpExpires = undefined;
        user.otpPurpose = undefined;
        await user.save({ validateBeforeSave: false });
    },

    async login(payload: any): Promise<IAuthResponse> {
        const { email, phone, password } = payload;

        // Find user by email OR phone
        let user;
        if (email) {
            user = await User.findByEmail(email);
        } else if (phone) {
            user = await User.findOne({ phone: phone.trim() }).select('+password');
        }

        if (!user) throw new AppError(401, 'Invalid credentials. No account found.');
        if (user.isDeleted) throw new AppError(401, 'This account has been deleted');
        if (user.status === 'blocked') throw new AppError(403, 'Your account has been blocked. Contact support.');

        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) throw new AppError(401, 'Incorrect password.');

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        const tokens = this.generateTokens(jwtPayload);

        return {
            user: { _id: user._id!.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: user.avatar },
            tokens,
        };
    },

    // ── Sign in / up with Google ──────────────────────────────
    // Verifies a Google credential (either an ID token from the One-Tap/button
    // flow, or an OAuth access token from the custom-button flow) with Google,
    // then logs the matching user in or creates a fresh account. No password
    // is ever exchanged.
    async googleLogin(input: { code?: string; idToken?: string; accessToken?: string }): Promise<IAuthResponse> {
        const { code, idToken, accessToken } = input || {};
        let payload: any = {};

        if (code) {
            // Authorization-code (popup) flow: exchange the one-time code for tokens
            // using the client secret (server-side only), then read the ID token.
            if (!config.google.client_id || !config.google.client_secret) {
                throw new AppError(503, 'Google login is not configured on the server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
            }
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: config.google.client_id,
                    client_secret: config.google.client_secret,
                    redirect_uri: 'postmessage', // popup ux_mode
                    grant_type: 'authorization_code',
                }).toString(),
            });
            const tokens: any = await tokenRes.json().catch(() => ({}));
            if (!tokenRes.ok || !tokens?.id_token) {
                throw new AppError(401, 'Google authorization failed. Please try again.');
            }
            // The ID token came straight from Google's token endpoint over a
            // server-to-server HTTPS call, so we can read its claims directly.
            payload = (jwt.decode(tokens.id_token) as any) || {};
            if (config.google.client_id && payload.aud !== config.google.client_id) {
                throw new AppError(401, 'This Google sign-in is not authorized for S Kawsar Sunnah Mart.');
            }
        } else if (idToken) {
            // ID token: tokeninfo validates signature + expiry and returns the claims.
            const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
            payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.email) {
                throw new AppError(401, 'Could not verify your Google account. Please try again.');
            }
            // Must be minted for OUR app (prevents token reuse from another Google app).
            if (config.google.client_id && payload.aud !== config.google.client_id) {
                throw new AppError(401, 'This Google sign-in is not authorized for S Kawsar Sunnah Mart.');
            }
        } else if (accessToken) {
            // Access token: first confirm which app it was issued to (aud), then
            // pull the profile (name/picture) from the userinfo endpoint.
            const tiRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
            const ti: any = await tiRes.json().catch(() => ({}));
            if (!tiRes.ok || !ti?.aud) {
                throw new AppError(401, 'Could not verify your Google account. Please try again.');
            }
            if (config.google.client_id && ti.aud !== config.google.client_id) {
                throw new AppError(401, 'This Google sign-in is not authorized for S Kawsar Sunnah Mart.');
            }
            const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            payload = await uiRes.json().catch(() => ({}));
            if (!uiRes.ok || !payload?.email) {
                throw new AppError(401, 'Could not read your Google profile. Please try again.');
            }
        } else {
            throw new AppError(400, 'Missing Google credential.');
        }

        if (payload.email_verified !== true && payload.email_verified !== 'true') {
            throw new AppError(401, 'Your Google email is not verified.');
        }

        const email = String(payload.email).toLowerCase();
        let user = await User.findOne({ email });

        if (user) {
            if (user.isDeleted) throw new AppError(401, 'This account has been deleted.');
            if (user.status === 'blocked') throw new AppError(403, 'Your account has been blocked. Contact support.');
            // Backfill avatar / verified flag for existing accounts on first Google login.
            let dirty = false;
            if (!user.avatar && payload.picture) { user.avatar = payload.picture; dirty = true; }
            if (!user.isEmailVerified) { user.isEmailVerified = true; dirty = true; }
            if (dirty) await user.save({ validateBeforeSave: false });
        } else {
            // New account — Google emails are already verified, so skip the email flow.
            const randomPassword = crypto.randomBytes(24).toString('hex'); // satisfies schema; user signs in via Google
            const firstName = payload.given_name || String(payload.name || email).split(' ')[0] || 'Google';
            const lastName = payload.family_name || String(payload.name || '').split(' ').slice(1).join(' ') || '.';
            user = await User.create({
                email,
                firstName,
                lastName,
                password: randomPassword,
                avatar: payload.picture || '',
                status: 'active',
                isEmailVerified: true,
            });
        }

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        const tokens = this.generateTokens(jwtPayload);

        return {
            user: { _id: user._id!.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: user.avatar },
            tokens,
        };
    },

    async refreshToken(refreshToken: string): Promise<ITokens> {
        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(refreshToken, config.jwt.refresh_secret) as JwtPayload;
        } catch {
            throw new AppError(401, 'Invalid or expired refresh token');
        }

        const user = await User.findById(decoded.userId);
        if (!user || user.isDeleted) throw new AppError(401, 'User not found');
        if (user.status === 'blocked') throw new AppError(403, 'Your account has been blocked');

        if (user.isPasswordChangedAfterJwtIssued(decoded.iat as number)) {
            throw new AppError(401, 'Password changed. Please login again.');
        }

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        return this.generateTokens(jwtPayload);
    },

    async forgotPassword(email: string): Promise<{ resetLink: string } | null> {
        const user = await User.findOne({ email, isDeleted: false });
        // No email enumeration — caller always responds success even if not found.
        if (!user) return null;

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = sha256(resetToken);
        user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await user.save({ validateBeforeSave: false });

        const resetLink = `${config.frontend_url}/reset-password?token=${resetToken}`;
        const { subject, html } = buildResetEmail(resetLink);
        await sendEmail({ to: user.email, subject, html });

        return { resetLink };
    },

    async resetPassword(token: string, newPassword: string): Promise<void> {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
            isDeleted: false,
        });

        if (!user) throw new AppError(400, 'Invalid or expired reset token');
        user.password = newPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
    },

    async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        const user = await User.findById(userId).select('+password');
        if (!user || user.isDeleted) throw new AppError(404, 'User not found');

        const isPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isPasswordCorrect) throw new AppError(401, 'Current password is incorrect');

        user.password = newPassword;
        await user.save();
    },

    async getMe(userId: string) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },

    // ── Admin: impersonate (login-as) a target user ──────────────
    // Signs a normal access token for the target user so the admin can
    // act as them. Returns the same shape as a normal login (minus refresh).
    async loginAs(targetUserId: string): Promise<{ user: IAuthResponse['user']; tokens: { accessToken: string } }> {
        const user = await User.findById(targetUserId);
        if (!user || user.isDeleted) throw new AppError(404, 'Target user not found');
        if (user.status === 'blocked') throw new AppError(403, 'Cannot impersonate a blocked account.');

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        const accessToken = jwt.sign(jwtPayload, config.jwt.access_secret, {
            expiresIn: config.jwt.access_expires_in as SignOptions['expiresIn'],
        });

        return {
            user: {
                _id: user._id!.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                avatar: user.avatar,
            },
            tokens: { accessToken },
        };
    },
};

export default AuthService;
