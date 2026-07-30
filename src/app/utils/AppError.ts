class AppError extends Error {
    public statusCode: number;
    public status: string;
    public isOperational: boolean;

    constructor(statusCode: number, message: string, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export default AppError;
