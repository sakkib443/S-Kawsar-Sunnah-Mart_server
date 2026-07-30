import express from 'express';
import AuthController from './auth.controller';
import validateRequest from '../../middlewares/validateRequest';
import { registerValidation, loginValidation, refreshTokenValidation, forgotPasswordValidation, resetPasswordValidation, updatePasswordValidation, verifyEmailValidation, resendVerificationValidation, sendOtpValidation, verifyOtpValidation } from './auth.validation';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';

const router = express.Router();

router.post('/register', validateRequest(registerValidation), AuthController.register);
router.post('/login', validateRequest(loginValidation), AuthController.login);
router.post('/google', AuthController.googleLogin);
router.post('/refresh-token', validateRequest(refreshTokenValidation), AuthController.refreshToken);
router.post('/verify-email', validateRequest(verifyEmailValidation), AuthController.verifyEmail);
router.post('/resend-verification', validateRequest(resendVerificationValidation), AuthController.resendVerification);
router.post('/send-otp', validateRequest(sendOtpValidation), AuthController.sendOtp);
router.post('/verify-otp', validateRequest(verifyOtpValidation), AuthController.verifyOtp);
router.post('/forgot-password', validateRequest(forgotPasswordValidation), AuthController.forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordValidation), AuthController.resetPassword);
router.post('/update-password', authMiddleware, validateRequest(updatePasswordValidation), AuthController.updatePassword);
router.get('/me', authMiddleware, AuthController.getMe);
router.post('/logout', AuthController.logout);
router.post('/login-as/:userId', authMiddleware, authorizeRoles('admin', 'superadmin'), AuthController.loginAs);

export const AuthRoutes = router;
