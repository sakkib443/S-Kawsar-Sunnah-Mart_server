import { Schema, model } from 'mongoose';

// ── Ticker Item ──
const tickerItemSchema = new Schema({
    text: { type: String, required: true },
    emoji: { type: String, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, { _id: true });

// ── Contact Info ──
const businessHourSchema = new Schema({
    day: { type: String, required: true },
    time: { type: String, required: true },
}, { _id: true });

const socialLinkSchema = new Schema({
    label: { type: String, required: true },
    url: { type: String, default: '#' },
    color: { type: String, default: '#000000' },
}, { _id: true });

// ── Main Site Content Schema ──
const siteContentSchema = new Schema({
    // Only one document — singleton
    _key: { type: String, default: 'main', unique: true },

    // ── Header Ticker ──
    ticker: [tickerItemSchema],

    // ── Contact Page ──
    contact: {
        phone: { type: String, default: '' },            // primary phone (for tel: links)
        phones: { type: [String], default: [] },         // additional phones — shown as list
        whatsapp: { type: String, default: '' },
        email: { type: String, default: '' },
        emails: { type: [String], default: [] },         // additional emails
        address: { type: String, default: '' },
        corporateOffice: { type: String, default: '' },  // corporate/head office address
        warehouse: { type: String, default: '' },        // warehouse address
        website: { type: String, default: '' },
        hours: [businessHourSchema],
        tips: [{ type: String }],
        socials: [socialLinkSchema],
        subjects: [{ type: String }],
    },

    // ── Floating Widget ──
    floating: {
        phone: { type: String, default: '' },
        whatsapp: { type: String, default: '' },
        messenger: { type: String, default: '' },
        showPhone: { type: Boolean, default: true },
        showWhatsapp: { type: Boolean, default: true },
        showMessenger: { type: Boolean, default: true },
    },

    // ── Mobile Payment Numbers (bKash / Rocket / Nagad) ──
    payment: {
        bkash:  { number: { type: String, default: '' }, accountType: { type: String, default: 'Personal' }, active: { type: Boolean, default: true } },
        rocket: { number: { type: String, default: '' }, accountType: { type: String, default: 'Personal' }, active: { type: Boolean, default: true } },
        nagad:  { number: { type: String, default: '' }, accountType: { type: String, default: 'Personal' }, active: { type: Boolean, default: true } },
        cod:    { active: { type: Boolean, default: true } }, // Cash on Delivery show/hide toggle
        instructions: { type: String, default: 'Send Money to the number above, then submit your number, transaction ID and payment time below.' },
    },

    // ── Footer ──
    footer: {
        companyName: { type: String, default: 'S Kawsar Sunnah Mart' },
        copyright: { type: String, default: '' },
        links: [{
            label: { type: String, required: true },
            url: { type: String, required: true },
        }],
    },

    // ── Default Product Tagline ──
    defaultTagline: { type: String, default: 'Your trusted online marketplace' },

    // ── SEO / Meta ──
    seo: {
        title: { type: String, default: 'S Kawsar Sunnah Mart - Your trusted online marketplace' },
        description: { type: String, default: 'Shop the latest products with amazing deals at S Kawsar Sunnah Mart.' },
        keywords: { type: String, default: 's kawsar sunnah mart, skawsarsunnahmart, ecommerce, online shopping' },
    },

    // ── Announcement Bar ──
    announcement: {
        message: { type: String, default: '' },
        bgColor: { type: String, default: '#E4525C' },
        textColor: { type: String, default: '#FFFFFF' },
        active: { type: Boolean, default: false },
        dismissible: { type: Boolean, default: true },
    },

    // ── Legal Pages (Terms, Privacy, Refund) ──
    legalPages: [{
        slug: { type: String, required: true, enum: ['terms', 'privacy', 'refund'] },
        title: { type: String, required: true },
        content: { type: String, default: '' },
        active: { type: Boolean, default: true },
        lastUpdated: { type: Date, default: Date.now },
    }],

    // ── Theme / Appearance ──
    theme: {
        primaryColor: { type: String, default: '#4F46E5' },
        secondaryColor: { type: String, default: '#6366F1' },
        logoUrl: { type: String, default: '/images/logo.png' },
        faviconUrl: { type: String, default: '' },
    },

    // ── Hero Slides ──
    // ── Hero Banner Slides ──
    // Text is kept OUT of the image on purpose: real HTML text stays sharp on
    // every screen, scales down on mobile, renders Bengali correctly and can be
    // edited here without regenerating the artwork. Leave the fields blank for a
    // banner that already carries its own baked-in wording — then no overlay is
    // drawn and the image shows exactly as uploaded.
    heroSlides: [{
        imageUrl: { type: String, required: true },
        active: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        ctaLabel: { type: String, default: '' },
        ctaHref: { type: String, default: '/products' },
        // Which side of the banner the text sits on — match it to the empty
        // side of the artwork.
        align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
        // Text colour over the artwork: 'light' = white on a dark banner.
        textTone: { type: String, enum: ['light', 'dark'], default: 'light' },
        // Soft brand-tinted gradient behind the copy so it stays readable over
        // light patches of the photo. Off only for already-dark artwork.
        scrim: { type: Boolean, default: true },
    }],

    // ── Mid-page promo banner ──
    // A single wide banner shown on the homepage between "Popular Products" and
    // "New Arrivals". Same shape as a hero slide so the admin edits it the same
    // way; `active: false` (or a blank imageUrl) hides it entirely.
    homeBanner: {
        imageUrl: { type: String, default: '' },
        active: { type: Boolean, default: true },
        link: { type: String, default: '/products' },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        ctaLabel: { type: String, default: '' },
        align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
        textTone: { type: String, enum: ['light', 'dark'], default: 'light' },
        scrim: { type: Boolean, default: true },
    },

}, { timestamps: true });

export const SiteContent = model('SiteContent', siteContentSchema);
