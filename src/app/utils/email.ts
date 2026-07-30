import nodemailer from 'nodemailer';
import config from '../config';

/**
 * Email infrastructure for S Kawsar Sunnah Mart.
 *
 * In production, set EMAIL_HOST / EMAIL_USER / EMAIL_PASS (and optionally
 * EMAIL_PORT / EMAIL_FROM) and a real SMTP transporter is used.
 *
 * In development (when SMTP is not configured) emails are logged to the
 * console and the call resolves successfully — it never throws. The auth
 * controllers expose the verify/reset links + OTP via a `dev` field in this
 * mode so the flow stays testable without an SMTP server.
 */

export interface IEmailAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
}

interface ISendEmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: IEmailAttachment[];
}

/** True only when host, user and pass are all present. */
export const isEmailConfigured = (): boolean => {
    return Boolean(config.email.host && config.email.user && config.email.pass);
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.port === 465, // true for 465, false for 587/others
            auth: {
                user: config.email.user,
                pass: config.email.pass,
            },
        });
    }
    return transporter;
};

/** Strip HTML tags to produce a readable plain-text fallback for dev logging. */
const htmlToText = (html: string): string => {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Send an email. In dev mode (SMTP not configured) the email is logged to
 * the console and the promise resolves — it never throws.
 */
export const sendEmail = async ({ to, subject, html, attachments }: ISendEmailOptions): Promise<void> => {
    if (!isEmailConfigured()) {
        // Dev mode — log the email instead of sending it.
        console.log('\n──────────── 📧 EMAIL (dev mode, SMTP not configured) ────────────');
        console.log(`To:      ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body:    ${htmlToText(html)}`);
        if (attachments && attachments.length) {
            console.log(`(${attachments.length} attachment${attachments.length === 1 ? '' : 's'})`);
        }
        console.log('───────────────────────────────────────────────────────────────────\n');
        return;
    }

    try {
        await getTransporter().sendMail({
            from: config.email.from,
            to,
            subject,
            html,
            ...(attachments && attachments.length ? { attachments } : {}),
        });
        console.log(`[Email] Sent "${subject}" to ${to}`);
    } catch (error) {
        // Don't break the auth flow if email delivery fails — log and move on.
        console.error('[Email] Failed to send email:', error);
    }
};

export default sendEmail;
