import { Types } from 'mongoose';
import config from '../../config';
import AppError from '../../utils/AppError';
import { Order } from '../order/order.model';
import { notifyOrderPayment } from '../order/order.service';
import { emitFinanceUpdate } from '../../utils/socket';
import { Transaction } from './payment.model';
import { ITransaction, PaymentMethod, GatewayMethod, TransactionStatus } from './payment.interface';

/**
 * Node 18+/22 ships a global `fetch`, but the project's TS `lib` is ES2020
 * (no DOM types), so we declare a minimal signature here to stay type-clean
 * without pulling in extra dependencies.
 */
declare const fetch: (
    url: string,
    init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }
) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<any>;
    text: () => Promise<string>;
}>;

// ── Helpers: is a gateway configured? ────────────────────────────────
const isSslcommerzConfigured = (): boolean =>
    Boolean(config.sslcommerz.store_id && config.sslcommerz.store_passwd);

const isBkashConfigured = (): boolean =>
    Boolean(
        config.bkash.app_key &&
        config.bkash.app_secret &&
        config.bkash.username &&
        config.bkash.password
    );

const isNagadConfigured = (): boolean =>
    Boolean(config.nagad.merchant_id && config.nagad.private_key && config.nagad.live);

const isRocketConfigured = (): boolean =>
    Boolean(config.rocket.merchant_id && config.rocket.api_key && config.rocket.live);

const backendUrl = (): string => config.payment.backend_url.replace(/\/+$/, '');
const frontendUrl = (): string => config.payment.frontend_url.replace(/\/+$/, '');

const sslcommerzApiBase = (): string =>
    config.sslcommerz.sandbox
        ? 'https://sandbox.sslcommerz.com'
        : 'https://securepay.sslcommerz.com';

const bkashApiBase = (): string => config.bkash.base_url.replace(/\/+$/, '');

// A safe wrapper so raw gateway/network errors never bubble to the client.
const safeFetchJson = async (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<any | null> => {
    try {
        const res = await fetch(url, init);
        try {
            return await res.json();
        } catch {
            return null;
        }
    } catch {
        return null;
    }
};

// ── Result type returned by init/retry ───────────────────────────────
export interface InitResult {
    redirectUrl: string;
    transactionId: string;
}

// ── Internal: build a SIMULATION redirect URL (dev / no creds) ───────
const buildSimulationUrl = (txnId: string, method: PaymentMethod, amount: number): string =>
    `${frontendUrl()}/payment/simulate?txn=${txnId}&method=${method}&amount=${amount}`;

// ── Internal: mark order paid/failed from a transaction ──────────────
const applyOrderOutcome = async (
    txn: { order: Types.ObjectId | any; gatewayTxnId?: string },
    outcome: 'paid' | 'failed' | 'refunded'
): Promise<void> => {
    const orderId = (txn.order && txn.order._id) ? txn.order._id : txn.order;
    const order = await Order.findById(orderId);
    if (!order) return;

    if (outcome === 'paid') {
        order.paymentStatus = 'paid';
        if (txn.gatewayTxnId) order.transactionId = txn.gatewayTxnId;
        order.timeline.push({
            status: 'payment_received',
            note: 'Payment confirmed via gateway',
            createdAt: new Date(),
        } as any);
    } else if (outcome === 'failed') {
        order.paymentStatus = 'failed';
        order.timeline.push({
            status: 'payment_failed',
            note: 'Payment failed/cancelled at gateway',
            createdAt: new Date(),
        } as any);
    }
    await order.save();
    // Money moved → push a live refresh to admin dashboards.
    if (outcome === 'paid') emitFinanceUpdate('payment_received');
    // ...and tell the customer, exactly as the manual admin path does.
    notifyOrderPayment(order, outcome);
};

// ── SSLCommerz: create a checkout session ────────────────────────────
const initSslcommerzSession = async (
    order: any,
    txnId: string,
    amount: number
): Promise<string> => {
    const addr = order.shippingAddress || {};
    const form: Record<string, string> = {
        store_id: config.sslcommerz.store_id,
        store_passwd: config.sslcommerz.store_passwd,
        total_amount: String(amount),
        currency: 'BDT',
        tran_id: txnId,
        success_url: `${backendUrl()}/api/payments/sslcommerz/success`,
        fail_url: `${backendUrl()}/api/payments/sslcommerz/fail`,
        cancel_url: `${backendUrl()}/api/payments/sslcommerz/cancel`,
        ipn_url: `${backendUrl()}/api/payments/sslcommerz/ipn`,
        shipping_method: 'NO',
        product_name: `Order ${order.orderId || order._id}`,
        product_category: 'general',
        product_profile: 'general',
        cus_name: addr.fullName || 'Customer',
        cus_email: addr.email || 'customer@example.com',
        cus_add1: addr.address || 'N/A',
        cus_city: addr.city || 'Dhaka',
        cus_postcode: addr.postalCode || '0000',
        cus_country: 'Bangladesh',
        cus_phone: addr.phone || '01700000000',
    };

    const body = new URLSearchParams(form).toString();
    const data = await safeFetchJson(`${sslcommerzApiBase()}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (data && (data.status === 'SUCCESS' || data.GatewayPageURL) && data.GatewayPageURL) {
        return data.GatewayPageURL as string;
    }
    throw new AppError(502, 'Failed to initialize SSLCommerz payment session.');
};

// ── bKash: grant token + create tokenized payment ────────────────────
const bkashGrantToken = async (): Promise<string | null> => {
    const data = await safeFetchJson(`${bkashApiBase()}/tokenized/checkout/token/grant`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            username: config.bkash.username,
            password: config.bkash.password,
        },
        body: JSON.stringify({
            app_key: config.bkash.app_key,
            app_secret: config.bkash.app_secret,
        }),
    });
    return data?.id_token || null;
};

const initBkashPayment = async (
    order: any,
    txnId: string,
    amount: number
): Promise<{ bkashURL: string; paymentID: string }> => {
    const token = await bkashGrantToken();
    if (!token) throw new AppError(502, 'Failed to authenticate with bKash.');

    const data = await safeFetchJson(`${bkashApiBase()}/tokenized/checkout/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: token,
            'X-APP-Key': config.bkash.app_key,
        },
        body: JSON.stringify({
            mode: '0011',
            payerReference: order.orderId || String(order._id),
            callbackURL: `${frontendUrl()}/payment/bkash/callback`,
            amount: String(amount),
            currency: 'BDT',
            intent: 'sale',
            merchantInvoiceNumber: txnId,
        }),
    });

    if (data && data.bkashURL && data.paymentID) {
        return { bkashURL: data.bkashURL as string, paymentID: data.paymentID as string };
    }
    throw new AppError(502, 'Failed to create bKash payment.');
};

// ── Nagad: merchant checkout session ─────────────────────────────────
// The full Nagad flow is: POST /check-out/initialize/{merchantId}/{orderId} →
// receive a challenge → RSA-sign it with NAGAD_PRIVATE_KEY → POST
// /check-out/complete/{paymentRefId} → receive { callBackUrl }. That signing
// step is provider-crypto specific, so it's wired the moment the merchant keys
// + API spec are provided. `isNagadConfigured()` gates it (requires NAGAD_LIVE=true),
// so until then Nagad flows through the shared dev-simulation like any other
// unconfigured method — the whole pipeline stays testable end-to-end.
const initNagadSession = async (
    _order: any,
    _txnId: string,
    _amount: number
): Promise<{ redirectUrl: string; gatewayTxnId?: string }> => {
    // TODO(nagad-live): implement initialize → sign challenge → complete here.
    throw new AppError(501, 'Nagad live gateway is not wired yet. Provide the Nagad merchant API spec + keys.');
};

// ── Rocket (DBBL): merchant checkout session ─────────────────────────
const initRocketSession = async (
    _order: any,
    _txnId: string,
    _amount: number
): Promise<{ redirectUrl: string; gatewayTxnId?: string }> => {
    // TODO(rocket-live): implement the Rocket/DBBL merchant checkout call here.
    throw new AppError(501, 'Rocket live gateway is not wired yet. Provide the Rocket merchant API spec + keys.');
};

// ── Gateway provider registry ────────────────────────────────────────
// Adding a gateway = one entry here + a config block + its session fn. Each
// provider reports whether it's configured (real creds present) and how to
// create a checkout session. initPayment uses ONE code path for all of them,
// falling back to dev-simulation whenever a provider isn't configured — so a
// gateway goes live purely by adding its .env keys; no other code changes.
interface GatewayProvider {
    label: string;
    isConfigured: () => boolean;
    createSession: (order: any, txnId: string, amount: number) => Promise<{ redirectUrl: string; gatewayTxnId?: string }>;
}

const gatewayProviders: Record<GatewayMethod, GatewayProvider> = {
    sslcommerz: {
        label: 'SSLCommerz',
        isConfigured: isSslcommerzConfigured,
        createSession: async (order, txnId, amount) => ({
            redirectUrl: await initSslcommerzSession(order, txnId, amount),
            gatewayTxnId: txnId, // tran_id == our transaction id
        }),
    },
    bkash: {
        label: 'bKash',
        isConfigured: isBkashConfigured,
        createSession: async (order, txnId, amount) => {
            const { bkashURL, paymentID } = await initBkashPayment(order, txnId, amount);
            return { redirectUrl: bkashURL, gatewayTxnId: paymentID };
        },
    },
    nagad: {
        label: 'Nagad',
        isConfigured: isNagadConfigured,
        createSession: initNagadSession,
    },
    rocket: {
        label: 'Rocket',
        isConfigured: isRocketConfigured,
        createSession: initRocketSession,
    },
};

// ─────────────────────────────────────────────────────────────────────
// PUBLIC SERVICE API
// ─────────────────────────────────────────────────────────────────────

/**
 * initPayment — load order, create a Transaction (initiated), and return a
 * redirect URL. Falls back to a DEV-SIMULATION url when the gateway has no creds.
 */
const initPayment = async ({
    orderId,
    method,
}: {
    orderId: string;
    method: PaymentMethod;
}): Promise<InitResult> => {
    if (!Types.ObjectId.isValid(orderId)) {
        throw new AppError(400, 'Invalid order id.');
    }

    const order = await Order.findById(orderId);
    if (!order) throw new AppError(404, 'Order not found.');

    // COD never goes through a gateway.
    if (method === 'cod') {
        throw new AppError(400, 'COD orders do not require gateway payment.');
    }

    const amount = order.total;

    const txn = await Transaction.create({
        order: order._id,
        user: order.user || null,
        method,
        amount,
        status: 'initiated',
        gateway: '',
        gatewayTxnId: '',
        gatewayResponse: null,
    });
    const transactionId = String(txn._id);

    try {
        // One code path for every gateway: if the provider is configured, use
        // the real session; otherwise fall back to dev-simulation. New gateways
        // (Nagad/Rocket/…) plug in via the registry with zero changes here.
        const provider = gatewayProviders[method as GatewayMethod];
        if (provider && provider.isConfigured()) {
            txn.gateway = method;
            txn.status = 'pending';
            const session = await provider.createSession(order, transactionId, amount);
            txn.gatewayTxnId = session.gatewayTxnId || transactionId;
            await txn.save();
            return { redirectUrl: session.redirectUrl, transactionId };
        }

        // DEV-SIMULATION fallback (gateway not configured for this method).
        txn.gateway = 'dev-simulation';
        txn.status = 'pending';
        await txn.save();
        return {
            redirectUrl: buildSimulationUrl(transactionId, method, amount),
            transactionId,
        };
    } catch (err) {
        // Never leak raw gateway errors: mark txn failed and rethrow a clean AppError.
        txn.status = 'failed';
        txn.gatewayResponse = { error: err instanceof Error ? err.message : 'gateway error' };
        await txn.save();
        if (err instanceof AppError) throw err;
        throw new AppError(502, 'Payment initialization failed. Please try again.');
    }
};

/**
 * SSLCommerz callbacks. Returns the transaction id (tran_id) and resulting
 * paymentStatus so the controller can redirect the browser appropriately.
 */
const handleSslcommerzCallback = async (
    outcome: 'success' | 'fail' | 'cancel' | 'ipn',
    payload: Record<string, any>
): Promise<{ transactionId: string; status: TransactionStatus }> => {
    const tranId: string = payload.tran_id || '';
    const txn = tranId && Types.ObjectId.isValid(tranId)
        ? await Transaction.findById(tranId)
        : null;

    if (!txn) {
        return { transactionId: tranId, status: 'failed' };
    }

    // Already settled — idempotent.
    if (txn.status === 'success') {
        return { transactionId: tranId, status: 'success' };
    }

    if (outcome === 'fail') {
        txn.status = 'failed';
        txn.gatewayResponse = payload;
        await txn.save();
        await applyOrderOutcome(txn, 'failed');
        return { transactionId: tranId, status: 'failed' };
    }

    if (outcome === 'cancel') {
        txn.status = 'cancelled';
        txn.gatewayResponse = payload;
        await txn.save();
        await applyOrderOutcome(txn, 'failed');
        return { transactionId: tranId, status: 'cancelled' };
    }

    // success or ipn → validate val_id with SSLCommerz when configured.
    let valid = true;
    if (isSslcommerzConfigured() && payload.val_id) {
        const validateUrl =
            `${sslcommerzApiBase()}/validator/api/validationserverAPI.php` +
            `?val_id=${encodeURIComponent(payload.val_id)}` +
            `&store_id=${encodeURIComponent(config.sslcommerz.store_id)}` +
            `&store_passwd=${encodeURIComponent(config.sslcommerz.store_passwd)}` +
            `&format=json`;
        const data = await safeFetchJson(validateUrl);
        valid = Boolean(data && (data.status === 'VALID' || data.status === 'VALIDATED'));
    }

    if (valid) {
        txn.status = 'success';
        txn.gatewayTxnId = payload.bank_tran_id || payload.val_id || txn.gatewayTxnId;
        txn.gatewayResponse = payload;
        await txn.save();
        await applyOrderOutcome(txn, 'paid');
        return { transactionId: tranId, status: 'success' };
    }

    txn.status = 'failed';
    txn.gatewayResponse = payload;
    await txn.save();
    await applyOrderOutcome(txn, 'failed');
    return { transactionId: tranId, status: 'failed' };
};

/**
 * bKash execute step. Given a paymentID, execute the payment and, on success,
 * mark the transaction + order paid.
 */
const executeBkash = async (
    paymentID: string
): Promise<{ transactionId: string; status: TransactionStatus }> => {
    const txn = await Transaction.findOne({ method: 'bkash', gatewayTxnId: paymentID });
    if (!txn) throw new AppError(404, 'Transaction not found for this paymentID.');

    if (txn.status === 'success') {
        return { transactionId: String(txn._id), status: 'success' };
    }

    if (!isBkashConfigured()) {
        // Without creds we can't really execute; treat as failed (sim flow uses /simulate/confirm).
        txn.status = 'failed';
        await txn.save();
        await applyOrderOutcome(txn, 'failed');
        return { transactionId: String(txn._id), status: 'failed' };
    }

    const token = await bkashGrantToken();
    let data: any = null;
    if (token) {
        data = await safeFetchJson(`${bkashApiBase()}/tokenized/checkout/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: token,
                'X-APP-Key': config.bkash.app_key,
            },
            body: JSON.stringify({ paymentID }),
        });
    }

    const success =
        data &&
        (data.statusCode === '0000' || data.transactionStatus === 'Completed');

    if (success) {
        txn.status = 'success';
        txn.gatewayTxnId = data.trxID || paymentID;
        txn.gatewayResponse = data;
        await txn.save();
        await applyOrderOutcome(txn, 'paid');
        return { transactionId: String(txn._id), status: 'success' };
    }

    txn.status = 'failed';
    txn.gatewayResponse = data || { error: 'execute failed' };
    await txn.save();
    await applyOrderOutcome(txn, 'failed');
    return { transactionId: String(txn._id), status: 'failed' };
};

/**
 * DEV-SIM confirm — called by the frontend /payment/simulate page.
 * Only meaningful for dev-simulation transactions. Marks txn + order.
 */
const confirmSimulated = async (
    transactionId: string,
    outcome: 'success' | 'fail' | 'cancel'
): Promise<{ transactionId: string; status: TransactionStatus }> => {
    if (!Types.ObjectId.isValid(transactionId)) {
        throw new AppError(400, 'Invalid transaction id.');
    }
    const txn = await Transaction.findById(transactionId);
    if (!txn) throw new AppError(404, 'Transaction not found.');

    if (txn.gateway !== 'dev-simulation') {
        throw new AppError(400, 'This transaction is not a simulated payment.');
    }

    if (txn.status === 'success') {
        return { transactionId, status: 'success' };
    }

    if (outcome === 'success') {
        txn.status = 'success';
        txn.gatewayTxnId = `SIM-${Date.now()}`;
        txn.gatewayResponse = { simulated: true, outcome };
        await txn.save();
        await applyOrderOutcome(txn, 'paid');
        return { transactionId, status: 'success' };
    }

    const newStatus: TransactionStatus = outcome === 'cancel' ? 'cancelled' : 'failed';
    txn.status = newStatus;
    txn.gatewayResponse = { simulated: true, outcome };
    await txn.save();
    await applyOrderOutcome(txn, 'failed');
    return { transactionId, status: newStatus };
};

/**
 * verifyPayment — return current transaction + order paymentStatus.
 */
const verifyPayment = async (transactionId: string) => {
    if (!Types.ObjectId.isValid(transactionId)) {
        throw new AppError(400, 'Invalid transaction id.');
    }
    const txn = await Transaction.findById(transactionId).lean();
    if (!txn) throw new AppError(404, 'Transaction not found.');

    const order = await Order.findById(txn.order)
        .select('orderId paymentStatus paymentMethod total status transactionId')
        .lean();

    return {
        transaction: txn,
        orderPaymentStatus: order?.paymentStatus || 'pending',
        order,
    };
};

/**
 * getMyTransactions — payment history for a user.
 */
const getMyTransactions = async (userId: string) => {
    return Transaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .populate('order', 'orderId total paymentStatus status')
        .lean();
};

/**
 * retryPayment — for a failed/cancelled transaction, create a fresh init for
 * the SAME order (failed-payment recovery). Returns a new redirectUrl.
 */
const retryPayment = async (
    transactionId: string,
    userId?: string
): Promise<InitResult> => {
    if (!Types.ObjectId.isValid(transactionId)) {
        throw new AppError(400, 'Invalid transaction id.');
    }
    const old = await Transaction.findById(transactionId);
    if (!old) throw new AppError(404, 'Transaction not found.');

    // Only owner may retry (when a user context is present).
    if (userId && old.user && String(old.user) !== String(userId)) {
        throw new AppError(403, 'You cannot retry this payment.');
    }

    if (old.status === 'success') {
        throw new AppError(400, 'This payment already succeeded.');
    }

    if (old.method === 'cod') {
        throw new AppError(400, 'COD orders do not require gateway payment.');
    }

    return initPayment({ orderId: String(old.order), method: old.method });
};

/**
 * What the checkout is allowed to offer, and HOW each method takes money.
 *
 * This is the single source of truth for the old contradiction where bKash both
 * asked for a manual "Send Money" receipt AND redirected to a gateway. A method
 * is now exactly one of:
 *
 *   'gateway' — hand off to the provider. live:true once its keys are in .env;
 *               live:false means the sandbox/demo screen (preview of the real
 *               experience, clearly labelled — no real money moves).
 *   'manual'  — no gateway keys, but the shop published a wallet number: the
 *               customer sends money and submits the receipt details.
 *   'cod'     — pay on delivery.
 *
 * A wallet with neither keys nor a published number cannot take money at all,
 * so it is not offered.
 */
const WALLETS: GatewayMethod[] = ['bkash', 'nagad', 'rocket'];

const getAvailableMethods = async () => {
    const { SiteContent } = require('../siteContent/siteContent.model');
    const site = await SiteContent.findOne({ _key: 'main' }).select('payment').lean();
    const pay: any = site?.payment || {};

    const methods: any[] = [];

    for (const id of WALLETS) {
        const wallet = pay[id] || {};
        if (wallet.active === false) continue;

        const provider = gatewayProviders[id];
        if (provider?.isConfigured()) {
            methods.push({ id, label: provider.label, mode: 'gateway', live: true });
        } else if (wallet.number) {
            methods.push({
                id,
                label: provider?.label || id,
                mode: 'manual',
                live: false,
                number: wallet.number,
                accountType: wallet.accountType || 'Personal',
            });
        }
        // else: no keys and no number → it cannot accept payment, so don't offer it.
    }

    // Cards/net-banking have no manual equivalent, so this is always a gateway.
    // Without keys it still resolves to the demo screen, which is how the
    // gateway experience can be shown before a merchant account exists.
    methods.push({
        id: 'sslcommerz',
        label: gatewayProviders.sslcommerz.label,
        mode: 'gateway',
        live: isSslcommerzConfigured(),
    });

    if (pay?.cod?.active !== false) {
        methods.push({ id: 'cod', label: 'Cash on Delivery', mode: 'cod', live: true });
    }

    return { methods, instructions: pay.instructions || '' };
};

export const PaymentService = {
    initPayment,
    handleSslcommerzCallback,
    executeBkash,
    confirmSimulated,
    verifyPayment,
    getMyTransactions,
    retryPayment,
    getAvailableMethods,
    // exposed for potential reuse/testing
    isSslcommerzConfigured,
    isBkashConfigured,
};

export type { ITransaction };
