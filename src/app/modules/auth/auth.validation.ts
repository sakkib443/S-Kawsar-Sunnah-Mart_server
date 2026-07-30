import { z } from 'zod';

export const registerValidation = z.object({
    body: z.object({
        firstName: z.string().min(1, 'First name is required').max(50),
        lastName: z.string().max(50).optional().default(''),
        email: z.string().email('Invalid email address').optional(),
        phone: z.string().min(6, 'Invalid phone number').optional(),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        location: z.string().optional(),
    }).refine(data => data.email || data.phone, {
        message: 'Email or phone number is required',
        path: ['email'],
    }),
});

export const loginValidation = z.object({
    body: z.object({
        email: z.string().email('Invalid email address').optional(),
        phone: z.string().min(6, 'Invalid phone number').optional(),
        password: z.string().min(1, 'Password is required'),
    }).refine(data => data.email || data.phone, {
        message: 'Email or phone number is required',
        path: ['email'],
    }),
});

export const refreshTokenValidation = z.object({
    body: z.object({
        refreshToken: z.string().min(1, 'Refresh token is required'),
    }),
});

export const forgotPasswordValidation = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
    }),
});

export const resetPasswordValidation = z.object({
    body: z.object({
        token: z.string().min(1, 'Token is required'),
        newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    }),
});

export const updatePasswordValidation = z.object({
    body: z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    }),
});

export const verifyEmailValidation = z.object({
    body: z.object({
        token: z.string().min(1, 'Token is required'),
    }),
});

export const resendVerificationValidation = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
    }),
});

export const sendOtpValidation = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        purpose: z.string().min(1).optional().default('verification'),
    }),
});

export const verifyOtpValidation = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        code: z.string().regex(/^\d{6}$/, 'Code must be a 6-digit number'),
        purpose: z.string().min(1).optional().default('verification'),
    }),
});

export type TRegisterInput = z.infer<typeof registerValidation>['body'];
export type TLoginInput = z.infer<typeof loginValidation>['body'];
