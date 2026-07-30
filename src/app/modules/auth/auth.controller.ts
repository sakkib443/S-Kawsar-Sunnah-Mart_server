import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { isEmailConfigured } from '../../utils/email';
import AuthService from './auth.service';
import config from '../../config';

/**
 * Build a `dev` payload that exposes verify/reset links + OTP so the flow is
 * testable without SMTP. Returns undefined when email IS configured, so dev
 * secrets are never leaked in production.
 */
const devPayload = (
    fields: { verifyLink?: string; otp?: string; resetLink?: string }
): { dev: typeof fields } | undefined => {
    if (isEmailConfigured()) return undefined;
    return { dev: fields };
};

const AuthController = {
    register: catchAsync(async (req: Request, res: Response) => {
        const { verifyLink, ...result } = await AuthService.register(req.body);
        sendResponse(res, {
            statusCode: 201,
            success: true,
            message: 'Registration successful. Please verify your email.',
            data: { ...result, ...devPayload({ verifyLink }) },
        });
    }),

    verifyEmail: catchAsync(async (req: Request, res: Response) => {
        await AuthService.verifyEmail(req.body.token);
        sendResponse(res, { statusCode: 200, success: true, message: 'Email verified successfully' });
    }),

    resendVerification: catchAsync(async (req: Request, res: Response) => {
        const result = await AuthService.resendVerification(req.body.email);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'If an unverified account exists for that email, a verification link has been sent.',
            data: devPayload({ verifyLink: result?.verifyLink }),
        });
    }),

    sendOtp: catchAsync(async (req: Request, res: Response) => {
        const { email, purpose } = req.body;
        const result = await AuthService.sendOtp(email, purpose || 'verification');
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'If an account exists for that email, a verification code has been sent.',
            data: devPayload({ otp: result?.otp }),
        });
    }),

    verifyOtp: catchAsync(async (req: Request, res: Response) => {
        const { email, code, purpose } = req.body;
        await AuthService.verifyOtp(email, code, purpose || 'verification');
        sendResponse(res, { statusCode: 200, success: true, message: 'Code verified successfully' });
    }),

    login: catchAsync(async (req: Request, res: Response) => {
        const result = await AuthService.login(req.body);

        // Set refresh token in cookie
        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config.env === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        sendResponse(res, { statusCode: 200, success: true, message: 'Login successful', data: result });
    }),

    googleLogin: catchAsync(async (req: Request, res: Response) => {
        const result = await AuthService.googleLogin({
            code: req.body?.code,
            idToken: req.body?.idToken || req.body?.credential,
            accessToken: req.body?.accessToken,
        });

        res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: config.env === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        sendResponse(res, { statusCode: 200, success: true, message: 'Signed in with Google', data: result });
    }),

    refreshToken: catchAsync(async (req: Request, res: Response) => {
        const { refreshToken } = req.body;
        const tokens = await AuthService.refreshToken(refreshToken);
        sendResponse(res, { statusCode: 200, success: true, message: 'Token refreshed', data: tokens });
    }),

    forgotPassword: catchAsync(async (req: Request, res: Response) => {
        const result = await AuthService.forgotPassword(req.body.email);
        // Always respond success (no email enumeration). Reset link is emailed;
        // only exposed in the response via `dev` when SMTP is not configured.
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'If an account exists for that email, a password reset link has been sent.',
            data: devPayload({ resetLink: result?.resetLink }),
        });
    }),

    resetPassword: catchAsync(async (req: Request, res: Response) => {
        const { token, newPassword } = req.body;
        await AuthService.resetPassword(token, newPassword);
        sendResponse(res, { statusCode: 200, success: true, message: 'Password reset successful' });
    }),

    updatePassword: catchAsync(async (req: Request, res: Response) => {
        const { currentPassword, newPassword } = req.body;
        await AuthService.updatePassword(req.user!.userId, currentPassword, newPassword);
        sendResponse(res, { statusCode: 200, success: true, message: 'Password updated successfully' });
    }),

    getMe: catchAsync(async (req: Request, res: Response) => {
        const user = await AuthService.getMe(req.user!.userId);
        sendResponse(res, { statusCode: 200, success: true, message: 'Profile fetched', data: user });
    }),

    logout: catchAsync(async (req: Request, res: Response) => {
        res.clearCookie('refreshToken');
        sendResponse(res, { statusCode: 200, success: true, message: 'Logged out successfully' });
    }),

    // Admin: login-as (impersonate) a target user.
    loginAs: catchAsync(async (req: Request, res: Response) => {
        const result = await AuthService.loginAs(req.params.userId);

        // Record the impersonation in the activity log (fire-and-forget).
        try {
            const { ActivityLogService } = require('../activityLog/activityLog.service');
            ActivityLogService.logActivity({
                actor: req.user?.userId,
                actorName: req.user?.email,
                action: 'login_as',
                target: `User:${req.params.userId}`,
                meta: { targetEmail: result.user.email, targetRole: result.user.role },
            }).catch(() => {});
        } catch {
            // never block impersonation on a logging failure
        }

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: `Now acting as ${result.user.email}`,
            data: result,
        });
    }),
};

export default AuthController;
