import PDFDocument from 'pdfkit';
import { Order } from '../order/order.model';
import { Product } from '../product/product.model';
import { ReturnRequest } from '../return/return.model';

const INDIGO = '#4F46E5';

const fmt = (n: number): string =>
    `BDT ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ════════════════════════════════════════════════════════════
//  ADMIN ENHANCEMENTS
// ════════════════════════════════════════════════════════════

const getLowStock = async (threshold = 10) => {
    const products = await Product.find({
        isDeleted: false,
        stock: { $lte: threshold },
    })
        .sort({ stock: 1 })
        .limit(50)
        .select('name thumbnail stock')
        .lean();

    return products.map((p: any) => ({
        _id: p._id,
        name: p.name,
        thumbnail: p.thumbnail || '',
        stock: p.stock || 0,
    }));
};

const getReturnsSummary = async () => {
    const agg = await ReturnRequest.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                refundAmount: { $sum: '$refundAmount' },
            },
        },
    ]);

    const summary = {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        refunded: 0,
        refundAmount: 0,
    };
    for (const row of agg) {
        summary.total += row.count;
        if (row._id === 'pending') summary.pending = row.count;
        if (row._id === 'approved') summary.approved = row.count;
        if (row._id === 'rejected') summary.rejected = row.count;
        if (row._id === 'refunded') {
            summary.refunded = row.count;
            summary.refundAmount += row.refundAmount || 0;
        }
    }
    return summary;
};

// Reused platform aggregations for the admin PDF.
const getAdminPlatformSummary = async () => {
    const [revenueData, totalOrders, totalProducts, totalCustomers] = await Promise.all([
        Order.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, totalRevenue: { $sum: '$total' } } },
        ]),
        Order.countDocuments(),
        Product.countDocuments({ isDeleted: false }),
        Order.distinct('user').then((u) => u.length),
    ]);
    return {
        totalRevenue: revenueData[0]?.totalRevenue || 0,
        totalOrders,
        totalProducts,
        totalCustomers,
    };
};

const getAdminTopProducts = async (limit = 10) => {
    return Product.find({ isDeleted: false })
        .sort('-totalSold')
        .limit(limit)
        .select('name totalSold price rating')
        .lean();
};

const getAdminSalesByCategory = async () => {
    return Order.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'productInfo',
            },
        },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'categories',
                localField: 'productInfo.category',
                foreignField: '_id',
                as: 'categoryInfo',
            },
        },
        { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                // Uncategorized / deleted-category sales roll up into one labelled bucket.
                _id: { $ifNull: ['$categoryInfo._id', 'uncategorized'] },
                name: { $first: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] } },
                totalSales: { $sum: '$items.total' },
                totalItems: { $sum: '$items.quantity' },
            },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 },
    ]);
};

// ════════════════════════════════════════════════════════════
//  PDF GENERATION (pdfkit — buffer collect pattern from invoice)
// ════════════════════════════════════════════════════════════

const drawHeader = (
    doc: PDFKit.PDFDocument,
    color: string,
    title: string,
    subtitle: string,
    left: number,
    contentWidth: number
) => {
    doc.rect(0, 0, doc.page.width, 90).fill(color);
    doc.fillColor('#FFFFFF').fontSize(26).font('Helvetica-Bold').text('S Kawsar Sunnah Mart', left, 24);
    doc.fontSize(13).font('Helvetica').text(title, left, 56);
    doc.fontSize(9)
        .font('Helvetica')
        .text(subtitle, left, 30, { width: contentWidth, align: 'right' });
    doc.text(
        `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        left,
        46,
        { width: contentWidth, align: 'right' }
    );
    doc.fillColor('#000000');
};

const generateAdminReportPdf = async (): Promise<Buffer> => {
    const [summary, topProducts, byCategory] = await Promise.all([
        getAdminPlatformSummary(),
        getAdminTopProducts(10),
        getAdminSalesByCategory(),
    ]);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const chunks: Buffer[] = [];
            doc.on('data', (c: Buffer) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (e: Error) => reject(e));

            const left = doc.page.margins.left;
            const right = doc.page.width - doc.page.margins.right;
            const contentWidth = right - left;

            drawHeader(doc, INDIGO, 'PLATFORM ANALYTICS', 'Admin Report', left, contentWidth);

            let y = 115;
            doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(12).text('Platform Summary', left, y);
            y += 24;

            const stats: [string, string][] = [
                ['Total Revenue', fmt(summary.totalRevenue)],
                ['Total Orders', String(summary.totalOrders)],
                ['Total Products', String(summary.totalProducts)],
                ['Total Customers', String(summary.totalCustomers)],
            ];
            const colW = contentWidth / 2;
            const cardH = 46;
            stats.forEach((s, i) => {
                const col = i % 2;
                const rowIdx = Math.floor(i / 2);
                const cx = left + col * colW;
                const cy = y + rowIdx * (cardH + 8);
                doc.roundedRect(cx, cy, colW - 8, cardH, 6).fillAndStroke('#EEF0FF', INDIGO);
                doc.fillColor('#888888').font('Helvetica').fontSize(8).text(s[0], cx + 8, cy + 8, { width: colW - 24 });
                doc.fillColor('#222222').font('Helvetica-Bold').fontSize(14).text(s[1], cx + 8, cy + 22, { width: colW - 16 });
            });
            y += Math.ceil(stats.length / 2) * (cardH + 8) + 16;

            // Top products.
            doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(12).text('Top Products', left, y);
            y += 20;
            doc.rect(left, y, contentWidth, 22).fill(INDIGO);
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
            doc.text('Product', left + 6, y + 7, { width: contentWidth * 0.6 });
            doc.text('Units Sold', left + contentWidth * 0.6, y + 7, { width: contentWidth * 0.4 - 6, align: 'right' });
            y += 22;
            doc.font('Helvetica').fontSize(9);
            for (const p of topProducts as any[]) {
                if (y + 20 > doc.page.height - 70) {
                    doc.addPage();
                    y = 50;
                }
                doc.fillColor('#222222');
                doc.text(p.name, left + 6, y + 6, { width: contentWidth * 0.6 - 6, ellipsis: true });
                doc.text(String(p.totalSold || 0), left + contentWidth * 0.6, y + 6, { width: contentWidth * 0.4 - 6, align: 'right' });
                doc.moveTo(left, y + 20).lineTo(right, y + 20).strokeColor('#EEEEEE').stroke();
                y += 20;
            }

            y += 16;
            // Sales by category.
            doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(12).text('Sales by Category', left, y);
            y += 20;
            doc.rect(left, y, contentWidth, 22).fill(INDIGO);
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
            doc.text('Category', left + 6, y + 7, { width: contentWidth * 0.5 });
            doc.text('Items', left + contentWidth * 0.5, y + 7, { width: contentWidth * 0.2, align: 'right' });
            doc.text('Sales', left + contentWidth * 0.7, y + 7, { width: contentWidth * 0.3 - 6, align: 'right' });
            y += 22;
            doc.font('Helvetica').fontSize(9);
            for (const c of byCategory as any[]) {
                if (y + 20 > doc.page.height - 70) {
                    doc.addPage();
                    y = 50;
                }
                doc.fillColor('#222222');
                doc.text(c.name || 'Uncategorized', left + 6, y + 6, { width: contentWidth * 0.5 - 6, ellipsis: true });
                doc.text(String(c.totalItems || 0), left + contentWidth * 0.5, y + 6, { width: contentWidth * 0.2, align: 'right' });
                doc.text(fmt(c.totalSales || 0), left + contentWidth * 0.7, y + 6, { width: contentWidth * 0.3 - 6, align: 'right' });
                doc.moveTo(left, y + 20).lineTo(right, y + 20).strokeColor('#EEEEEE').stroke();
                y += 20;
            }

            doc.font('Helvetica-Oblique').fontSize(9).fillColor('#888888').text(
                'S Kawsar Sunnah Mart Admin · Internal analytics report',
                left,
                doc.page.height - 50,
                { width: contentWidth, align: 'center' }
            );

            doc.end();
        } catch (e) {
            reject(e);
        }
    });
};

const AnalyticsService = {
    getLowStock,
    getReturnsSummary,
    generateAdminReportPdf,
};

export default AnalyticsService;
