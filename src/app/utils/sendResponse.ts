import { Response } from 'express';

interface IResponse<T> {
    statusCode: number;
    success: boolean;
    message: string;
    data?: T;
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const sendResponse = <T>(res: Response, data: IResponse<T>): void => {
    res.status(data.statusCode).json({
        success: data.success,
        message: data.message,
        meta: data.meta,
        data: data.data,
    });
};

export default sendResponse;
