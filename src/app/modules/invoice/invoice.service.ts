import PDFDocument from 'pdfkit';
import { Order } from '../order/order.model';
import AppError from '../../utils/AppError';
import { sendEmail } from '../../utils/email';

// ── Invoice data shapes (the contract the frontend consumes) ────────
export interface IInvoiceItem {
    name: string;
    sku: string;
    price: number;
    quantity: number;
    total: number;
}

export interface IInvoiceData {
    invoiceNumber: string;
    orderId: string;
    date: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    brand: 'S Kawsar Sunnah Mart';
    billTo: { name: string; phone: string; email: string };
    shipTo: {
        name: string;
        phone: string;
        address: string;
        area: string;
        city: string;
        postalCode: string;
    };
    items: IInvoiceItem[];
    subtotal: number;
    shippingCost: number;
    discount: number;
    total: number;
    couponCode: string;
}

const ORANGE = '#F85606';

const fmt = (n: number): string => `BDT ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Fetch an order with the populated fields invoices need.
 */
const fetchOrder = async (orderId: string): Promise<any> => {
    const order = await Order.findById(orderId)
        .populate('user', 'firstName lastName email phone')
        .populate('items.product', 'name sku thumbnail');
    if (!order) throw new AppError(404, 'Order not found');
    return order;
};

/**
 * Build the customer-facing InvoiceData from an order.
 */
const buildCustomerInvoice = (order: any): IInvoiceData => {
    const user = order.user || {};
    const ship = order.shippingAddress || {};
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || ship.fullName || '';

    const items: IInvoiceItem[] = (order.items || []).map((item: any) => ({
        name: item.name,
        sku: item.product?.sku || '',
        price: item.price,
        quantity: item.quantity,
        total: item.total,
    }));

    return {
        invoiceNumber: `INV-${order.orderId}`,
        orderId: order.orderId,
        date: new Date(order.createdAt).toISOString(),
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        brand: 'S Kawsar Sunnah Mart',
        billTo: {
            name,
            phone: ship.phone || user.phone || '',
            email: user.email || ship.email || '',
        },
        shipTo: {
            name: ship.fullName || name,
            phone: ship.phone || '',
            address: ship.address || '',
            area: ship.area || '',
            city: ship.city || '',
            postalCode: ship.postalCode || '',
        },
        items,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost || 0,
        discount: order.discount || 0,
        total: order.total,
        couponCode: order.couponCode || '',
    };
};

/**
 * Render an InvoiceData to a single-page PDF Buffer using pdfkit.
 */
const generateInvoicePdf = (invoice: IInvoiceData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err: Error) => reject(err));

            const pageWidth = doc.page.width;
            const left = doc.page.margins.left;
            const right = pageWidth - doc.page.margins.right;
            const contentWidth = right - left;

            // ── Orange header band ──
            doc.rect(0, 0, pageWidth, 90).fill(ORANGE);
            doc.fillColor('#FFFFFF').fontSize(26).font('Helvetica-Bold').text('S Kawsar Sunnah Mart', left, 24);
            doc.fontSize(13).font('Helvetica').text('INVOICE', left, 56);

            const dateStr = new Date(invoice.date).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
            });
            doc.fontSize(11).font('Helvetica-Bold').text(invoice.invoiceNumber, left, 28, { width: contentWidth, align: 'right' });
            doc.font('Helvetica').fontSize(9).text(`Date: ${dateStr}`, left, 46, { width: contentWidth, align: 'right' });
            doc.text(`Order: ${invoice.orderId}`, left, 60, { width: contentWidth, align: 'right' });

            doc.fillColor('#000000');
            let y = 115;

            // ── Bill To / Ship To columns ──
            const colW = contentWidth / 2 - 10;
            doc.fontSize(10).font('Helvetica-Bold').fillColor(ORANGE).text('Bill To', left, y);
            doc.fillColor('#000000').font('Helvetica').fontSize(9);
            doc.text(invoice.billTo.name, left, y + 16, { width: colW });
            doc.text(invoice.billTo.phone, left, y + 30, { width: colW });
            if (invoice.billTo.email) doc.text(invoice.billTo.email, left, y + 44, { width: colW });

            const col2 = left + colW + 20;
            doc.fontSize(10).font('Helvetica-Bold').fillColor(ORANGE).text('Ship To', col2, y);
            doc.fillColor('#000000').font('Helvetica').fontSize(9);
            doc.text(invoice.shipTo.name, col2, y + 16, { width: colW });
            const addrLine = [invoice.shipTo.address, invoice.shipTo.area, invoice.shipTo.city, invoice.shipTo.postalCode]
                .filter(Boolean).join(', ');
            doc.text(addrLine, col2, y + 30, { width: colW });
            doc.text(invoice.shipTo.phone, col2, y + 58, { width: colW });

            y += 100;

            // ── Items table ──
            const cols = {
                item: left,
                sku: left + contentWidth * 0.42,
                price: left + contentWidth * 0.6,
                qty: left + contentWidth * 0.76,
                total: left + contentWidth * 0.86,
            };

            doc.rect(left, y, contentWidth, 22).fill(ORANGE);
            doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
            doc.text('Item', cols.item + 6, y + 7, { width: contentWidth * 0.4 });
            doc.text('SKU', cols.sku, y + 7, { width: contentWidth * 0.16 });
            doc.text('Price', cols.price, y + 7, { width: contentWidth * 0.14, align: 'right' });
            doc.text('Qty', cols.qty, y + 7, { width: contentWidth * 0.08, align: 'right' });
            doc.text('Total', cols.total, y + 7, { width: contentWidth * 0.14 - 6, align: 'right' });

            y += 22;
            doc.fillColor('#000000').font('Helvetica').fontSize(9);

            for (const item of invoice.items) {
                const rowH = 20;
                if (y + rowH > doc.page.height - 120) {
                    doc.addPage();
                    y = 50;
                }
                doc.fillColor('#000000');
                doc.text(item.name, cols.item + 6, y + 6, { width: contentWidth * 0.4 - 6, ellipsis: true });
                doc.text(item.sku || '-', cols.sku, y + 6, { width: contentWidth * 0.16 });
                doc.text(fmt(item.price), cols.price, y + 6, { width: contentWidth * 0.14, align: 'right' });
                doc.text(String(item.quantity), cols.qty, y + 6, { width: contentWidth * 0.08, align: 'right' });
                doc.text(fmt(item.total), cols.total, y + 6, { width: contentWidth * 0.14 - 6, align: 'right' });
                doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor('#EEEEEE').stroke();
                y += rowH;
            }

            y += 14;

            // ── Totals block (right aligned) ──
            const totalsX = left + contentWidth * 0.55;
            const totalsW = contentWidth * 0.45;
            const labelW = totalsW * 0.55;
            const valW = totalsW * 0.45;

            const totalRow = (label: string, value: string, bold = false, color = '#000000') => {
                doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor(color);
                doc.text(label, totalsX, y, { width: labelW });
                doc.text(value, totalsX + labelW, y, { width: valW, align: 'right' });
                y += bold ? 20 : 16;
            };

            totalRow('Subtotal', fmt(invoice.subtotal));
            if (invoice.shippingCost > 0) totalRow('Shipping', fmt(invoice.shippingCost));
            if (invoice.discount > 0) totalRow('Discount', `- ${fmt(invoice.discount)}`);
            doc.moveTo(totalsX, y).lineTo(right, y).strokeColor(ORANGE).stroke();
            y += 6;
            totalRow('Grand Total', fmt(invoice.total), true, ORANGE);

            // ── Payment info ──
            y += 6;
            doc.fillColor('#000000').font('Helvetica').fontSize(9);
            doc.text(`Payment Method: ${invoice.paymentMethod}`, left, y);
            doc.text(`Payment Status: ${invoice.paymentStatus}`, left, y + 14);
            doc.text(`Order Status: ${invoice.status}`, left, y + 28);
            if (invoice.couponCode) doc.text(`Coupon: ${invoice.couponCode}`, left, y + 42);

            // ── Footer ──
            doc.font('Helvetica-Oblique').fontSize(9).fillColor('#888888')
                .text('Thank you for shopping with S Kawsar Sunnah Mart', left, doc.page.height - 60, {
                    width: contentWidth, align: 'center',
                });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Branded HTML invoice summary for the email body.
 */
const buildInvoiceEmailHtml = (invoice: IInvoiceData): string => {
    const rows = invoice.items
        .map(
            (i) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${i.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt(i.total)}</td>
        </tr>`
        )
        .join('');

    return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;">
    <div style="background:${ORANGE};color:#fff;padding:24px;">
      <h1 style="margin:0;font-size:22px;">S Kawsar Sunnah Mart</h1>
      <p style="margin:4px 0 0;font-size:14px;">Invoice ${invoice.invoiceNumber}</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 8px;">Order <strong>${invoice.orderId}</strong> &middot; ${new Date(invoice.date).toLocaleDateString('en-GB')}</p>
      <p style="margin:0 0 16px;color:#555;">Hi ${invoice.billTo.name || 'there'}, your invoice is attached as a PDF. Here is a summary:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid ${ORANGE};">Item</th>
            <th style="padding:8px;text-align:center;border-bottom:2px solid ${ORANGE};">Qty</th>
            <th style="padding:8px;text-align:right;border-bottom:2px solid ${ORANGE};">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;margin-top:16px;font-size:14px;">
        <tr><td style="padding:4px 8px;">Subtotal</td><td style="padding:4px 8px;text-align:right;">${fmt(invoice.subtotal)}</td></tr>
        <tr><td style="padding:4px 8px;">Shipping</td><td style="padding:4px 8px;text-align:right;">${fmt(invoice.shippingCost)}</td></tr>
        ${invoice.discount > 0 ? `<tr><td style="padding:4px 8px;">Discount</td><td style="padding:4px 8px;text-align:right;">- ${fmt(invoice.discount)}</td></tr>` : ''}
        <tr><td style="padding:8px;font-weight:bold;color:${ORANGE};border-top:2px solid ${ORANGE};">Grand Total</td><td style="padding:8px;text-align:right;font-weight:bold;color:${ORANGE};border-top:2px solid ${ORANGE};">${fmt(invoice.total)}</td></tr>
      </table>
      <p style="margin:16px 0 0;color:#555;">Payment: ${invoice.paymentMethod} (${invoice.paymentStatus})</p>
    </div>
    <div style="background:#fafafa;padding:16px;text-align:center;color:#888;font-size:12px;">
      Thank you for shopping with S Kawsar Sunnah Mart
    </div>
  </div>`;
};

// ── Auth-scoped public service methods ──────────────────────────────

const getInvoiceData = async (
    orderId: string,
    requester: { userId: string; role: string }
): Promise<IInvoiceData> => {
    const order = await fetchOrder(orderId);
    const isStaff = requester.role === 'admin' || requester.role === 'superadmin';
    if (!isStaff && order.user?._id?.toString() !== requester.userId) {
        throw new AppError(403, 'You do not have permission to view this invoice');
    }
    return buildCustomerInvoice(order);
};

const getInvoicePdf = async (
    orderId: string,
    requester: { userId: string; role: string }
): Promise<Buffer> => {
    const order = await fetchOrder(orderId);
    const isStaff = requester.role === 'admin' || requester.role === 'superadmin';
    if (!isStaff && order.user?._id?.toString() !== requester.userId) {
        throw new AppError(403, 'You do not have permission to view this invoice');
    }
    return generateInvoicePdf(buildCustomerInvoice(order));
};

/**
 * Build + email the customer invoice (PDF attached). Never throws to caller.
 */
const emailInvoiceToCustomer = async (orderId: string): Promise<void> => {
    try {
        const order = await fetchOrder(orderId);
        const invoice = buildCustomerInvoice(order);
        const pdf = await generateInvoicePdf(invoice);
        const to = order.user?.email || order.shippingAddress?.email;
        if (!to) {
            console.warn(`[Invoice] No email for order ${order.orderId}; skipping invoice email.`);
            return;
        }
        await sendEmail({
            to,
            subject: `Your S Kawsar Sunnah Mart Invoice ${invoice.invoiceNumber}`,
            html: buildInvoiceEmailHtml(invoice),
            attachments: [
                {
                    filename: `Invoice-${order.orderId}.pdf`,
                    content: pdf,
                    contentType: 'application/pdf',
                },
            ],
        });
    } catch (err) {
        console.error('[Invoice] Failed to email invoice:', err);
    }
};

const InvoiceService = {
    fetchOrder,
    buildCustomerInvoice,
    generateInvoicePdf,
    getInvoiceData,
    getInvoicePdf,
    emailInvoiceToCustomer,
};

export default InvoiceService;
