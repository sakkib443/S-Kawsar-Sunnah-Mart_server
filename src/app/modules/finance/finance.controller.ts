import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import {
    computeFinanceSummary,
    computeMethodBreakdown,
    computeMonthlySeries,
    computeLedger,
} from './finance.service';
import { streamFinancePdf, buildFinanceXlsx, FinanceReport } from './finance.export';

// Parse an ISO/date-ish query param → Date | undefined (invalid → undefined).
const parseDate = (v: unknown): Date | undefined => {
    if (!v) return undefined;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? undefined : d;
};

const FinanceController = {
    // GET /finance/summary?from=&to=  → live revenue / cost / net profit / margin,
    // plus per-method breakdown and a 12-month series.
    getSummary: catchAsync(async (req: Request, res: Response) => {
        const from = parseDate(req.query.from);
        const to = parseDate(req.query.to);
        const [summary, byMethod, monthly] = await Promise.all([
            computeFinanceSummary(from, to),
            computeMethodBreakdown(from, to),
            computeMonthlySeries(12),
        ]);
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Finance summary fetched',
            data: { summary, byMethod, monthly, range: { from: from || null, to: to || null } },
        });
    }),

    // Assemble the full report (shared by PDF + Excel).
    async buildReport(from?: Date, to?: Date): Promise<FinanceReport> {
        const [summary, byMethod, monthly, ledger] = await Promise.all([
            computeFinanceSummary(from, to),
            computeMethodBreakdown(from, to),
            computeMonthlySeries(12),
            computeLedger(from, to, 2000),
        ]);
        return { summary, byMethod, monthly, ledger, range: { from: from || null, to: to || null } };
    },

    // GET /finance/report/pdf?from=&to=
    getReportPdf: catchAsync(async (req: Request, res: Response) => {
        const report = await FinanceController.buildReport(parseDate(req.query.from), parseDate(req.query.to));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="finance-report-${Date.now()}.pdf"`);
        streamFinancePdf(res, report);
    }),

    // GET /finance/report/excel?from=&to=
    getReportExcel: catchAsync(async (req: Request, res: Response) => {
        const report = await FinanceController.buildReport(parseDate(req.query.from), parseDate(req.query.to));
        const buffer = await buildFinanceXlsx(report);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="finance-report-${Date.now()}.xlsx"`);
        res.send(buffer);
    }),
};

export default FinanceController;
