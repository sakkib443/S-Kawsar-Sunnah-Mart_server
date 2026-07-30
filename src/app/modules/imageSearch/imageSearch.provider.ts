import config from '../../config';

/**
 * AI Vision provider layer for image search — enable-on-key-drop.
 *
 * Image search always works with the built-in smart matcher (imageSearch.service).
 * The moment ANY of these provider keys is present in the environment, image
 * search upgrades to real AI object/label detection automatically — no code
 * change needed (same philosophy as the payment-gateway registry).
 *
 * To go live, add ONE of these to the backend .env:
 *   OPENAI_API_KEY=...            (GPT-4o vision — recommended)
 *   GOOGLE_VISION_API_KEY=...     (Google Cloud Vision)
 *   CLARIFAI_PAT=...              (Clarifai)
 *   HUGGINGFACE_API_KEY=...       (Hugging Face inference)
 * Optionally set AI_VISION_PROVIDER to force one when several keys are present.
 */

export interface VisionAnalysis {
    labels: string[];
    colors: string[];
}

export interface VisionProvider {
    id: 'openai' | 'google' | 'clarifai' | 'huggingface';
    label: string;
    isConfigured: () => boolean;
    analyze: (imageData: string) => Promise<VisionAnalysis | null>;
}

// A safe wrapper so raw provider/network errors never bubble to the client —
// on any failure image search silently falls back to the built-in matcher.
const safeFetchJson = async (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
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

// `imageData` is a data URL: "data:image/jpeg;base64,....". Strip the prefix
// for providers that want raw base64.
const rawBase64 = (imageData: string): string =>
    imageData.includes(',') ? imageData.split(',')[1] : imageData;

const dedupeLower = (arr: unknown[]): string[] =>
    Array.from(
        new Set(
            (arr as unknown[])
                .filter((x): x is string => typeof x === 'string')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean),
        ),
    );

// ── OpenAI (GPT-4o vision) ───────────────────────────────────────────────
const openaiProvider: VisionProvider = {
    id: 'openai',
    label: 'OpenAI Vision',
    isConfigured: () => Boolean(config.vision.openai.api_key),
    async analyze(imageData) {
        const body = {
            model: config.vision.openai.model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text:
                                'You are a product image tagger for an e-commerce visual search. ' +
                                'Look at the image and reply with ONLY compact JSON: ' +
                                '{"labels":["object","type","category","material"],"colors":["primary","secondary"]}. ' +
                                'Use lowercase single words. No prose.',
                        },
                        { type: 'image_url', image_url: { url: imageData } },
                    ],
                },
            ],
            max_tokens: 200,
            temperature: 0,
        };
        const json = await safeFetchJson('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.vision.openai.api_key}`,
            },
            body: JSON.stringify(body),
        });
        const text: string | undefined = json?.choices?.[0]?.message?.content;
        if (!text) return null;
        try {
            const match = text.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(match ? match[0] : text);
            return { labels: dedupeLower(parsed.labels || []), colors: dedupeLower(parsed.colors || []) };
        } catch {
            return null;
        }
    },
};

// ── Google Cloud Vision (label + image properties) ───────────────────────
const googleProvider: VisionProvider = {
    id: 'google',
    label: 'Google Cloud Vision',
    isConfigured: () => Boolean(config.vision.google.api_key),
    async analyze(imageData) {
        const body = {
            requests: [
                {
                    image: { content: rawBase64(imageData) },
                    features: [
                        { type: 'LABEL_DETECTION', maxResults: 10 },
                        { type: 'IMAGE_PROPERTIES' },
                        { type: 'OBJECT_LOCALIZATION', maxResults: 8 },
                    ],
                },
            ],
        };
        const json = await safeFetchJson(
            `https://vision.googleapis.com/v1/images:annotate?key=${config.vision.google.api_key}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        );
        const resp = json?.responses?.[0];
        if (!resp) return null;
        const labels = [
            ...(resp.labelAnnotations || []).map((l: any) => l.description),
            ...(resp.localizedObjectAnnotations || []).map((o: any) => o.name),
        ];
        // Map dominant RGB colours → nearest named colour (shared with the matcher).
        const colors = (resp.imagePropertiesAnnotation?.dominantColors?.colors || [])
            .slice(0, 4)
            .map((c: any) => nearestNamedColor(c.color?.red || 0, c.color?.green || 0, c.color?.blue || 0));
        return { labels: dedupeLower(labels), colors: dedupeLower(colors) };
    },
};

// ── Clarifai (general image recognition) ─────────────────────────────────
const clarifaiProvider: VisionProvider = {
    id: 'clarifai',
    label: 'Clarifai',
    isConfigured: () => Boolean(config.vision.clarifai.pat),
    async analyze(imageData) {
        const body = { inputs: [{ data: { image: { base64: rawBase64(imageData) } } }] };
        const json = await safeFetchJson(
            `https://api.clarifai.com/v2/models/${config.vision.clarifai.model_id}/outputs`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Key ${config.vision.clarifai.pat}`,
                },
                body: JSON.stringify(body),
            },
        );
        const concepts = json?.outputs?.[0]?.data?.concepts;
        if (!concepts) return null;
        const labels = concepts.filter((c: any) => (c.value ?? 0) >= 0.6).map((c: any) => c.name);
        return { labels: dedupeLower(labels), colors: [] };
    },
};

// ── Hugging Face (image classification) ──────────────────────────────────
const huggingfaceProvider: VisionProvider = {
    id: 'huggingface',
    label: 'Hugging Face',
    isConfigured: () => Boolean(config.vision.huggingface.api_key),
    async analyze(imageData) {
        // HF inference accepts raw base64 for image-classification pipelines.
        const json = await safeFetchJson(
            `https://api-inference.huggingface.co/models/${config.vision.huggingface.model}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.vision.huggingface.api_key}`,
                },
                body: JSON.stringify({ inputs: rawBase64(imageData) }),
            },
        );
        if (!Array.isArray(json)) return null;
        // Each label may be "sports car, sport car" — split into words.
        const labels = json
            .filter((p: any) => (p.score ?? 0) >= 0.05)
            .flatMap((p: any) => String(p.label || '').split(/[,\s]+/));
        return { labels: dedupeLower(labels), colors: [] };
    },
};

const ALL_PROVIDERS: VisionProvider[] = [openaiProvider, googleProvider, clarifaiProvider, huggingfaceProvider];

/** The active AI vision provider, or null when none is configured (→ built-in matcher). */
export function getActiveVisionProvider(): VisionProvider | null {
    const forced = (config.vision.provider || '').trim().toLowerCase();
    if (forced) {
        const p = ALL_PROVIDERS.find((x) => x.id === forced);
        if (p && p.isConfigured()) return p;
    }
    return ALL_PROVIDERS.find((p) => p.isConfigured()) || null;
}

/** Status snapshot for the storefront ("AI Visual Search" vs "Smart Visual Match"). */
export function getVisionStatus() {
    const active = getActiveVisionProvider();
    return {
        aiEnabled: Boolean(active),
        provider: active ? active.id : null,
        providerLabel: active ? active.label : null,
        supportedProviders: ALL_PROVIDERS.map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() })),
    };
}

// ── Named colour palette (shared anchor for provider colour mapping) ─────
// Kept in sync with the frontend extractor + the matcher's palette.
const NAMED_COLORS: { name: string; r: number; g: number; b: number }[] = [
    { name: 'red', r: 225, g: 29, b: 29 },
    { name: 'orange', r: 249, g: 115, b: 22 },
    { name: 'yellow', r: 234, g: 179, b: 8 },
    { name: 'green', r: 22, g: 163, b: 74 },
    { name: 'teal', r: 20, g: 184, b: 166 },
    { name: 'blue', r: 37, g: 99, b: 235 },
    { name: 'navy', r: 30, g: 58, b: 138 },
    { name: 'purple', r: 147, g: 51, b: 234 },
    { name: 'pink', r: 236, g: 72, b: 153 },
    { name: 'brown', r: 146, g: 64, b: 14 },
    { name: 'beige', r: 214, g: 199, b: 161 },
    { name: 'black', r: 17, g: 17, b: 17 },
    { name: 'white', r: 248, g: 248, b: 248 },
    { name: 'gray', r: 107, g: 114, b: 128 },
    { name: 'silver', r: 192, g: 192, b: 192 },
    { name: 'gold', r: 212, g: 175, b: 55 },
];

export function nearestNamedColor(r: number, g: number, b: number): string {
    let best = NAMED_COLORS[0];
    let bestDist = Infinity;
    for (const c of NAMED_COLORS) {
        const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return best.name;
}

export const COLOR_NAMES = NAMED_COLORS.map((c) => c.name);
