import { Product } from '../product/product.model';
import {
    getActiveVisionProvider,
    getVisionStatus,
    nearestNamedColor,
    COLOR_NAMES,
} from './imageSearch.provider';

/**
 * Image search service.
 *
 * analyze(): turns an uploaded image into a set of {colors, labels}. The colours
 *   are extracted in the browser (real canvas pixel analysis, free). If an AI
 *   vision provider is configured, the image is ALSO sent to it for richer
 *   object/label detection and the two are merged.
 *
 * search(): ranks the catalogue against those {colors, labels} using each
 *   product's colours, colour-hex, tags, aiLabels, name and category — so it
 *   works well even before any product has AI labels, and gets sharper as the
 *   catalogue (or the AI provider) fills them in.
 */

const COLOR_WORD_SET = new Set(COLOR_NAMES);

const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'with', 'of', 'in', 'on', 'to', 'by',
    'new', 'set', 'pack', 'pcs', 'pc', 'piece', 'pieces', 'size', 'pro', 'plus',
    'mah', 'ml', 'gm', 'kg', 'cm', 'mm', 'out', 'stock', 'zzqa6',
]);

const tokenize = (s: unknown): string[] =>
    typeof s === 'string'
        ? s
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ' ')
              .split(/\s+/)
              .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
        : [];

const norm = (arr: unknown): string[] =>
    Array.isArray(arr)
        ? Array.from(
              new Set(
                  arr
                      .filter((x): x is string => typeof x === 'string')
                      .map((s) => s.trim().toLowerCase())
                      .filter(Boolean),
              ),
          )
        : [];

// #rrggbb → nearest named colour.
const hexToNamed = (hex: string): string | null => {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const int = parseInt(m[1], 16);
    return nearestNamedColor((int >> 16) & 255, (int >> 8) & 255, int & 255);
};

// The colour vocabulary a product effectively carries: its colours[], the named
// colours of its colorHex[], and any colour words in its name.
const productColors = (p: any): Set<string> => {
    const s = new Set<string>();
    norm(p.colors).forEach((c) => COLOR_WORD_SET.has(c) && s.add(c));
    (Array.isArray(p.colorHex) ? p.colorHex : []).forEach((h: string) => {
        const n = hexToNamed(h);
        if (n) s.add(n);
    });
    tokenize(p.name).forEach((w) => COLOR_WORD_SET.has(w) && s.add(w));
    return s;
};

// The label vocabulary a product effectively carries.
const productLabels = (p: any): Set<string> => {
    const s = new Set<string>();
    norm(p.aiLabels).forEach((x) => s.add(x));
    norm(p.tags).forEach((x) => s.add(x));
    tokenize(p.name).forEach((w) => !COLOR_WORD_SET.has(w) && s.add(w));
    const catName = p.category && typeof p.category === 'object' ? p.category.name : '';
    tokenize(catName).forEach((w) => s.add(w));
    if (typeof p.brand === 'string') tokenize(p.brand).forEach((w) => s.add(w));
    return s;
};

const overlap = (a: Set<string>, b: string[]): number => b.reduce((n, x) => n + (a.has(x) ? 1 : 0), 0);

const ImageSearchService = {
    getStatus() {
        return getVisionStatus();
    },

    /** Merge the browser-extracted signal with an AI provider's (when configured). */
    async analyze(input: { colors?: string[]; labels?: string[]; imageData?: string }) {
        let colors = norm(input.colors).filter((c) => COLOR_WORD_SET.has(c));
        let labels = norm(input.labels);
        let source: 'ai' | 'smart' = 'smart';
        let provider: string | null = null;

        const active = getActiveVisionProvider();
        if (active && input.imageData) {
            const ai = await active.analyze(input.imageData);
            if (ai) {
                // AI colours are already named; keep only known names, else keep client ones.
                const aiColors = ai.colors.filter((c) => COLOR_WORD_SET.has(c));
                colors = Array.from(new Set([...aiColors, ...colors]));
                labels = Array.from(new Set([...ai.labels, ...labels]));
                source = 'ai';
                provider = active.id;
            }
        }
        return { colors, labels, source, provider };
    },

    /** Rank the catalogue against the analysed {colors, labels}. Never returns empty. */
    async search(analysis: { colors: string[]; labels: string[] }, limit = 24) {
        const detectedColors = analysis.colors || [];
        const detectedLabels = analysis.labels || [];

        const candidates = await Product.find({
            isDeleted: false,
            visibility: { $ne: 'hidden' },
        })
            .select('name slug thumbnail images price originalPrice discount stock rating reviewCount totalSold colors colorHex tags aiLabels brand category priceType')
            .populate('category', 'name slug')
            .limit(300);

        const scored = candidates.map((doc) => {
            const p: any = doc.toObject ? doc.toObject() : doc;
            const pColors = productColors(p);
            const pLabels = productLabels(p);

            const colorHits = overlap(pColors, detectedColors);
            const labelHits = overlap(pLabels, detectedLabels);

            // Colour matches weigh a little more than label matches for VISUAL search.
            const raw = colorHits * 3 + labelHits * 2;
            // Map to a friendly 0–100 "match" number: strong signal saturates near 98%.
            const denom = detectedColors.length * 3 + Math.min(detectedLabels.length, 4) * 2 || 1;
            const matchScore = raw > 0 ? Math.min(98, 55 + Math.round((raw / denom) * 43)) : 0;

            return { p, raw, matchScore, colorHits, labelHits };
        });

        // Rank: real matches first (by score, then popularity), then popular backfill so
        // the grid never looks broken even for an image nothing closely matches.
        scored.sort((a, b) => {
            if (b.raw !== a.raw) return b.raw - a.raw;
            return (b.p.totalSold || 0) - (a.p.totalSold || 0);
        });

        const matched = scored.filter((s) => s.raw > 0);
        // Show every real match, then popular products as an honest "you may also like"
        // backfill (matchScore 0 → the UI renders them without a match badge).
        const top = scored.slice(0, limit);

        return {
            products: top.map((s) => ({ ...s.p, matchScore: s.matchScore })),
            matchedCount: matched.length,
        };
    },
};

export default ImageSearchService;
