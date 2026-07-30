import { Inquiry } from './inquiry.model';
import { Product } from '../product/product.model';
import { notifyInquiryToWhatsApp } from '../../utils/whatsappNotify';

const InquiryService = {
    create: async (data: any) => {
        const inquiry = await Inquiry.create(data);

        // Send WhatsApp notification to admin (fire & forget)
        const product = await Product.findById(data.product).select('name');
        notifyInquiryToWhatsApp({
            customerName: data.name || '',
            customerPhone: data.phone || '',
            productName: product?.name || 'Unknown Product',
            message: data.message || '',
            color: data.color || '',
            size: data.size || '',
        }).catch(() => {}); // never block inquiry flow

        // ...and the in-app bell, so it lands live even when WhatsApp isn't set up.
        try {
            const { NotificationService } = require('../notification/notification.service');
            NotificationService.notifyAdmins({
                type: 'new_inquiry',
                title: 'New customer inquiry',
                message: `${data.name || 'A customer'} asked about "${product?.name || 'a product'}".`,
                link: '/dashboard/admin/inquiries',
                meta: { inquiryId: inquiry._id.toString(), product: String(data.product || '') },
            }).catch(() => {});
        } catch {
            // never block the inquiry flow
        }

        return inquiry;
    },

    getAll: async (query: Record<string, unknown>) => {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const skip = (page - 1) * limit;
        const filter: any = {};
        if (query.status) filter.status = query.status;
        if (query.product) filter.product = query.product;

        const [inquiries, total] = await Promise.all([
            Inquiry.find(filter)
                .populate('product', 'name slug thumbnail')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Inquiry.countDocuments(filter),
        ]);

        return {
            inquiries,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },

    getByProduct: async (productId: string) => {
        const inquiries = await Inquiry.find({ product: productId })
            .sort({ createdAt: -1 })
            .limit(50);
        return inquiries;
    },

    updateStatus: async (id: string, data: { status: string; adminReply?: string }) => {
        const inquiry = await Inquiry.findByIdAndUpdate(id, data, { new: true });
        if (!inquiry) throw new Error('Inquiry not found');
        return inquiry;
    },

    delete: async (id: string) => {
        const inquiry = await Inquiry.findByIdAndDelete(id);
        if (!inquiry) throw new Error('Inquiry not found');
        return inquiry;
    },
};

export default InquiryService;
