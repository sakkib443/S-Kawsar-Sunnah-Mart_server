import { Response } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { FinanceSummary, MethodBreakdown, LedgerRow } from './finance.service';

export interface FinanceReport {
    summary: FinanceSummary;
    byMethod: MethodBreakdown[];
    monthly: { label: string; year: number; revenue: number; netProfit: number; orders: number }[];
    ledger: LedgerRow[];
    range: { from: Date | null; to: Date | null };
}

const BRAND = '#F85606';
const money = (n: number) => 'BDT ' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rangeLabel = (r: { from: Date | null; to: Date | null }) => {
    const f = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null);
    if (r.from && r.to) return `${f(r.from)} — ${f(r.to)}`;
    if (r.from) return `From ${f(r.from)}`;
    if (r.to) return `Up to ${f(r.to)}`;
    return 'All time';
};
const methodLabel = (m: string) =>
    ({ bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', sslcommerz: 'SSLCommerz', cod: 'Cash on Delivery' } as Record<string, string>)[m] || m;

// ── PDF: streams a one-page financial report to the response ─────────
export function streamFinancePdf(res: Response, report: FinanceReport): void {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const { summary: s } = report;
    const left = 40;
    const width = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 90).fill(BRAND);
    doc.fillColor('#fff').fontSize(20).font('Helvetica-Bold').text('S Kawsar Sunnah Mart', left, 26);
    doc.fontSize(11).font('Helvetica').text('Financial Report', left, 52);
    doc.fontSize(9).text(rangeLabel(report.range), left, 68);
    doc.fillColor('#000');

    // Summary tiles
    let y = 115;
    const tiles: [string, string][] = [
        ['Total Revenue', money(s.revenue)],
        ['Net Profit', money(s.netProfit)],
        ['Cost of Goods', money(s.cost)],
        ['Profit Margin', `${Math.round(s.margin * 100)}%`],
        ['Paid Orders', String(s.paidOrders)],
        ['Avg Order Value', money(s.aov)],
    ];
    const tileW = (width - 20) / 3;
    tiles.forEach((t, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const tx = left + col * (tileW + 10);
        const ty = y + row * 60;
        doc.roundedRect(tx, ty, tileW, 50, 6).fillAndStroke('#FFF7F2', '#FDE1D0');
        doc.fillColor('#8a8a8a').fontSize(8).font('Helvetica-Bold').text(t[0].toUpperCase(), tx + 10, ty + 9, { width: tileW - 20 });
        doc.fillColor('#111').fontSize(13).font('Helvetica-Bold').text(t[1], tx + 10, ty + 24, { width: tileW - 20 });
    });
    y += 60 * Math.ceil(tiles.length / 3) + 15;

    const sectionTitle = (title: string) => {
        doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text(title, left, y);
        y += 18;
        doc.moveTo(left, y).lineTo(left + width, y).strokeColor('#eee').stroke();
        y += 8;
    };
    const rowLine = (cells: string[], widths: number[], bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(bold ? '#111' : '#444');
        let x = left;
        cells.forEach((c, i) => {
            doc.text(c, x + 2, y, { width: widths[i] - 4, align: i === 0 ? 'left' : 'right' });
            x += widths[i];
        });
        y += 16;
    };

    // By payment method
    sectionTitle('Revenue by Payment Method');
    const mW = [width * 0.4, width * 0.2, width * 0.2, width * 0.2];
    rowLine(['Method', 'Orders', 'Revenue', 'Net Profit'], mW, true);
    report.byMethod.forEach((m) => rowLine([methodLabel(m.method), String(m.orders), money(m.revenue), money(m.netProfit)], mW));
    y += 10;

    // Monthly
    if (y < doc.page.height - 160) {
        sectionTitle('Monthly Breakdown');
        const yW = [width * 0.4, width * 0.2, width * 0.2, width * 0.2];
        rowLine(['Month', 'Orders', 'Revenue', 'Net Profit'], yW, true);
        report.monthly.slice(-8).forEach((mo) =>
            rowLine([`${mo.label} ${mo.year}`, String(mo.orders), money(mo.revenue), money(mo.netProfit)], yW));
    }

    // Footer
    doc.fontSize(8).fillColor('#aaa').font('Helvetica').text(
        `Generated ${new Date().toLocaleString('en-GB')}  ·  Revenue counts PAID orders only  ·  Net profit = goods revenue (net discount) − cost of goods`,
        left, doc.page.height - 55, { width },
    );

    doc.end();
}

// ── Excel: builds a multi-sheet .xlsx workbook buffer ────────────────
export async function buildFinanceXlsx(report: FinanceReport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'S Kawsar Sunnah Mart';
    wb.created = new Date();

    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF85606' } };
    const styleHeader = (row: ExcelJS.Row) => {
        row.eachCell((c) => {
            c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            c.fill = headerFill;
            c.alignment = { vertical: 'middle' };
        });
    };

    // Summary sheet
    const s = report.summary;
    const sum = wb.addWorksheet('Summary');
    sum.columns = [{ width: 26 }, { width: 22 }];
    sum.addRow(['S Kawsar Sunnah Mart — Financial Report']).font = { bold: true, size: 14 };
    sum.addRow(['Range', rangeLabel(report.range)]);
    sum.addRow([]);
    const metricHeader = sum.addRow(['Metric', 'Value']);
    styleHeader(metricHeader);
    const metrics: [string, number | string][] = [
        ['Total Revenue (BDT)', s.revenue],
        ['Product Revenue (BDT)', s.productRevenue],
        ['Cost of Goods (BDT)', s.cost],
        ['Net Profit (BDT)', s.netProfit],
        ['Profit Margin', `${Math.round(s.margin * 100)}%`],
        ['Discounts Given (BDT)', s.discount],
        ['Shipping Collected (BDT)', s.shipping],
        ['Paid Orders', s.paidOrders],
        ['Avg Order Value (BDT)', Math.round(s.aov)],
    ];
    metrics.forEach((m) => sum.addRow(m));

    // By method
    const bm = wb.addWorksheet('By Method');
    bm.columns = [{ width: 20 }, { width: 12 }, { width: 16 }, { width: 16 }];
    styleHeader(bm.addRow(['Method', 'Orders', 'Revenue (BDT)', 'Net Profit (BDT)']));
    report.byMethod.forEach((m) => bm.addRow([methodLabel(m.method), m.orders, m.revenue, m.netProfit]));

    // Monthly
    const mo = wb.addWorksheet('Monthly');
    mo.columns = [{ width: 14 }, { width: 12 }, { width: 16 }, { width: 16 }];
    styleHeader(mo.addRow(['Month', 'Orders', 'Revenue (BDT)', 'Net Profit (BDT)']));
    report.monthly.forEach((m) => mo.addRow([`${m.label} ${m.year}`, m.orders, m.revenue, m.netProfit]));

    // Transactions ledger
    const tx = wb.addWorksheet('Transactions');
    tx.columns = [{ width: 16 }, { width: 20 }, { width: 22 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }];
    styleHeader(tx.addRow(['Order', 'Date', 'Customer', 'Method', 'Revenue', 'Cost', 'Profit']));
    report.ledger.forEach((r) =>
        tx.addRow([
            r.orderId,
            new Date(r.date).toLocaleString('en-GB'),
            r.customer,
            methodLabel(r.method),
            r.revenue,
            r.cost,
            r.profit,
        ]));

    const arr = await wb.xlsx.writeBuffer();
    return Buffer.from(arr as ArrayBuffer);
}
