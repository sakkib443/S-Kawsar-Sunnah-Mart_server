import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    database_url: process.env.DATABASE_URL || 'mongodb://localhost:27017/skawsarsunnahmart',

    // Human-readable order id prefix (e.g. SKS-0001). White-label: override via env.
    order_id_prefix: process.env.ORDER_ID_PREFIX || 'SKS',

    jwt: {
        access_secret: process.env.JWT_ACCESS_SECRET || 'skawsarsunnahmart-access-secret',
        refresh_secret: process.env.JWT_REFRESH_SECRET || 'skawsarsunnahmart-refresh-secret',
        access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
        refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,

    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
        api_key: process.env.CLOUDINARY_API_KEY || '',
        api_secret: process.env.CLOUDINARY_API_SECRET || '',
    },

    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.EMAIL_PORT) || 587,
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        from: process.env.EMAIL_FROM || 'noreply@skawsarsunnahmart.com',
    },

    frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Public base URL of THIS backend. Used to build absolute URLs for locally
    // stored image uploads (disk storage). Leave empty to auto-detect from the
    // incoming request — on the VPS, set it to your backend domain e.g.
    // https://api.yourdomain.com so image links are correct behind a proxy.
    backend_url: process.env.BACKEND_URL || '',

    pagination: {
        default_page: 1,
        default_limit: 10,
        max_limit: 100,
    },

    bkash: {
        app_key: process.env.BKASH_APP_KEY || '',
        app_secret: process.env.BKASH_APP_SECRET || '',
        username: process.env.BKASH_USERNAME || '',
        password: process.env.BKASH_PASSWORD || '',
        base_url: process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
        sandbox: process.env.BKASH_SANDBOX ? process.env.BKASH_SANDBOX === 'true' : true,
    },

    sslcommerz: {
        store_id: process.env.SSLCZ_STORE_ID || '',
        store_passwd: process.env.SSLCZ_STORE_PASSWD || '',
        sandbox: process.env.SSLCZ_SANDBOX ? process.env.SSLCZ_SANDBOX === 'true' : true,
    },

    // Nagad merchant checkout. Add these + set NAGAD_LIVE=true to go live; until
    // then the pipeline runs through the shared dev-simulation.
    nagad: {
        merchant_id: process.env.NAGAD_MERCHANT_ID || '',
        merchant_number: process.env.NAGAD_MERCHANT_NUMBER || '',
        public_key: process.env.NAGAD_PUBLIC_KEY || '',     // Nagad PG public key
        private_key: process.env.NAGAD_PRIVATE_KEY || '',   // merchant private key
        base_url: process.env.NAGAD_BASE_URL || 'https://sandbox-ssl.mynagad.com/api/dfs',
        sandbox: process.env.NAGAD_SANDBOX ? process.env.NAGAD_SANDBOX === 'true' : true,
        live: process.env.NAGAD_LIVE === 'true',            // gate: real API vs simulation
    },

    // Rocket (DBBL) merchant gateway. Same pattern.
    rocket: {
        merchant_id: process.env.ROCKET_MERCHANT_ID || '',
        api_key: process.env.ROCKET_API_KEY || '',
        api_secret: process.env.ROCKET_API_SECRET || '',
        base_url: process.env.ROCKET_BASE_URL || '',
        sandbox: process.env.ROCKET_SANDBOX ? process.env.ROCKET_SANDBOX === 'true' : true,
        live: process.env.ROCKET_LIVE === 'true',
    },

    // Base URLs used to build gateway callback + redirect URLs.
    payment: {
        backend_url: process.env.PAYMENT_BACKEND_URL || 'http://localhost:5000',
        frontend_url: process.env.PAYMENT_FRONTEND_URL || 'http://localhost:3000',
    },

    // Google OAuth — "Sign in with Google". Authorization-code (popup) flow:
    // the browser returns a one-time code, the server exchanges it for tokens
    // using the client id + secret. client_id must match the client's
    // NEXT_PUBLIC_GOOGLE_CLIENT_ID.
    google: {
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    },

    // ── AI Vision (Image Search) ──────────────────────────────────────────
    // Image search works out-of-the-box with a built-in smart colour+keyword
    // matcher (no key needed). Drop in ONE provider's API key below and image
    // search automatically upgrades to real AI object/label detection — no code
    // change (enable-on-key-drop, same pattern as the payment gateways).
    // Whichever key is present activates that provider; AI_VISION_PROVIDER can
    // force a specific one when several keys are set.
    vision: {
        provider: process.env.AI_VISION_PROVIDER || '', // '' = auto-detect | openai | google | clarifai | huggingface
        openai: {
            api_key: process.env.OPENAI_API_KEY || '',
            model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        },
        google: {
            api_key: process.env.GOOGLE_VISION_API_KEY || '',
        },
        clarifai: {
            pat: process.env.CLARIFAI_PAT || '',
            model_id: process.env.CLARIFAI_MODEL_ID || 'general-image-recognition',
        },
        huggingface: {
            api_key: process.env.HUGGINGFACE_API_KEY || '',
            model: process.env.HUGGINGFACE_VISION_MODEL || 'google/vit-base-patch16-224',
        },
    },

    // Steadfast Courier (Packzy) — delivery booking, status sync, COD.
    steadfast: {
        api_key: process.env.STEADFAST_API_KEY || '',
        secret_key: process.env.STEADFAST_SECRET_KEY || '',
        base_url: process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1',
        // Shared secret Steadfast must echo (query ?secret= or x-webhook-secret header) so
        // strangers can't spoof delivery-status webhooks. Empty = webhook accepts unsigned calls.
        webhook_secret: process.env.STEADFAST_WEBHOOK_SECRET || '',
        // Periodic background status pull (fallback when webhook isn't configured).
        // Opt-in: only runs when this is 'true' AND the API keys are present.
        auto_sync: process.env.STEADFAST_AUTO_SYNC === 'true',
        auto_sync_minutes: Number(process.env.STEADFAST_AUTO_SYNC_MINUTES) || 30,
    },
};
