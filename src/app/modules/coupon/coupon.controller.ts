import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import CouponService from './coupon.service';

const CouponController = {
    getAll: catchAsync(async (req: Request, res: Response) => {
        const coupons = await CouponService.getAll();
        sendResponse(res, { statusCode: 200, success: true, message: 'Coupons fetched', data: coupons });
    }),
    validate: catchAsync(async (req: Request, res: Response) => {
        const result = await CouponService.validate(req.body.code, { orderAmount: req.body.orderAmount, items: req.body.items });
        sendResponse(res, { statusCode: 200, success: true, message: 'Coupon is valid', data: result });
    }),
    create: catchAsync(async (req: Request, res: Response) => {
        const coupon = await CouponService.create(req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Coupon created', data: coupon });
    }),
    update: catchAsync(async (req: Request, res: Response) => {
        const coupon = await CouponService.update(req.params.id, req.body);
        sendResponse(res, { statusCode: 200, success: true, message: 'Coupon updated', data: coupon });
    }),
    delete: catchAsync(async (req: Request, res: Response) => {
        await CouponService.delete(req.params.id);
        sendResponse(res, { statusCode: 200, success: true, message: 'Coupon deleted' });
    }),
};

export default CouponController;
