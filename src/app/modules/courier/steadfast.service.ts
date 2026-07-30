import config from '../../config';
import AppError from '../../utils/AppError';

// ── Steadfast Courier (Packzy) API wrapper ───────────────────────────
// Docs: https://docs.google.com/document/d/1Pn... (Steadfast merchant API / Packzy)
// Every request needs both `Api-Key` and `Secret-Key` headers.

const { api_key, secret_key, base_url } = config.steadfast;

function ensureConfigured(): void {
    if (!api_key || !secret_key) {
        throw new AppError(
            503,
            'Steadfast courier is not configured. Add STEADFAST_API_KEY and STEADFAST_SECRET_KEY to the server .env, then restart.'
        );
    }
}

const headers = () => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Api-Key': api_key,
    'Secret-Key': secret_key,
});

export interface CreateConsignmentInput {
    invoice: string;          // unique per parcel (e.g. ABM-0001-ab12)
    recipientName: string;
    recipientPhone: string;   // 11-digit BD number
    recipientAddress: string;
    codAmount: number;        // 0 for prepaid; collectable amount for COD
    note?: string;
}

const SteadfastService = {
    // POST /create_order → { status, message, consignment: { consignment_id, tracking_code, status, ... } }
    async createConsignment(input: CreateConsignmentInput) {
        ensureConfigured();
        const res = await fetch(`${base_url}/create_order`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                invoice: input.invoice,
                recipient_name: input.recipientName,
                recipient_phone: input.recipientPhone,
                recipient_address: input.recipientAddress,
                cod_amount: input.codAmount,
                note: input.note || '',
            }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok || !data?.consignment) {
            throw new AppError(res.status || 502, data?.message || 'Steadfast: failed to create the consignment.');
        }
        return data.consignment as {
            consignment_id: number | string;
            invoice: string;
            tracking_code: string;
            status: string;
            cod_amount: number;
        };
    },

    // GET /status_by_trackingcode/{code} → { status, delivery_status }
    async getStatusByTrackingCode(trackingCode: string) {
        ensureConfigured();
        const res = await fetch(`${base_url}/status_by_trackingcode/${encodeURIComponent(trackingCode)}`, {
            headers: headers(),
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new AppError(res.status || 502, data?.message || 'Steadfast: failed to fetch status.');
        return data as { status: number; delivery_status: string };
    },

    // GET /status_by_cid/{consignment_id}
    async getStatusByCid(cid: string) {
        ensureConfigured();
        const res = await fetch(`${base_url}/status_by_cid/${encodeURIComponent(cid)}`, { headers: headers() });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new AppError(res.status || 502, data?.message || 'Steadfast: failed to fetch status.');
        return data as { status: number; delivery_status: string };
    },

    // GET /get_balance → { status, current_balance }
    async getBalance() {
        ensureConfigured();
        const res = await fetch(`${base_url}/get_balance`, { headers: headers() });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new AppError(res.status || 502, data?.message || 'Steadfast: failed to fetch balance.');
        return data as { status: number; current_balance: number };
    },
};

export default SteadfastService;
