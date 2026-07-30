import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import config from '../config';
import AppError from '../utils/AppError';

const handleZodError = (err: ZodError) => {
    const errors = err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
    }));
    return { statusCode: 400, message: 'Validation Error', errorMessages: errors };
};

const handleCastError = (err: any) => ({
    statusCode: 400,
    message: `Invalid ${err.path}: ${err.value}`,
    errorMessages: [{ path: err.path, message: `Invalid ${err.path}` }],
});

const handleDuplicateError = (err: any) => {
    const field = Object.keys(err.keyValue)[0];
    return {
        statusCode: 400,
        message: `${field} already exists`,
        errorMessages: [{ path: field, message: `${field} already exists` }],
    };
};

const handleValidationError = (err: any) => {
    const errors = Object.values(err.errors).map((el: any) => ({
        path: el.path,
        message: el.message,
    }));
    return { statusCode: 400, message: 'Validation Error', errorMessages: errors };
};

const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = 'Something went wrong!';
    let errorMessages: { path: string; message: string }[] = [];

    if (err instanceof ZodError) {
        const e = handleZodError(err);
        statusCode = e.statusCode; message = e.message; errorMessages = e.errorMessages;
    } else if (err instanceof AppError) {
        statusCode = err.statusCode; message = err.message;
        errorMessages = [{ path: '', message: err.message }];
    } else if (err.name === 'CastError') {
        const e = handleCastError(err);
        statusCode = e.statusCode; message = e.message; errorMessages = e.errorMessages;
    } else if (err.code === 11000) {
        const e = handleDuplicateError(err);
        statusCode = e.statusCode; message = e.message; errorMessages = e.errorMessages;
    } else if (err.name === 'ValidationError') {
        const e = handleValidationError(err);
        statusCode = e.statusCode; message = e.message; errorMessages = e.errorMessages;
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401; message = 'Invalid token. Please login again.';
        errorMessages = [{ path: '', message }];
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401; message = 'Token expired. Please login again.';
        errorMessages = [{ path: '', message }];
    } else if (err instanceof Error) {
        message = err.message; errorMessages = [{ path: '', message: err.message }];
    }

    res.status(statusCode).json({
        success: false,
        message,
        errorMessages,
        stack: config.env === 'development' ? err.stack : undefined,
    });
};

export default globalErrorHandler;
