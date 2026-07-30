/**
 * Server-side WhatsApp notification via WhatsApp Cloud API (Meta).
 * 
 * Setup instructions:
 * 1. Go to https://developers.facebook.com → Create App → Business type
 * 2. Add "WhatsApp" product
 * 3. Get your Phone Number ID and Access Token from WhatsApp > API Setup
 * 4. Add the admin's WhatsApp number as a recipient (test mode)
 * 5. Set env variables: WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ADMIN_PHONE
 */

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface WhatsAppConfig {
    token: string;
    phoneNumberId: string;
    adminPhone: string;
}

function getConfig(): WhatsAppConfig | null {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;

    if (!token || !phoneNumberId || !adminPhone) {
        return null;
    }
    return { token, phoneNumberId, adminPhone };
}

async function sendWhatsAppMessage(phone: string, message: string, config: WhatsAppConfig): Promise<boolean> {
    try {
        const response = await fetch(`${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: phone.replace(/[^0-9]/g, ''),
                type: 'text',
                text: { body: message },
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[WhatsApp] Failed to send:', err);
            return false;
        }

        console.log('[WhatsApp] Message sent successfully to', phone);
        return true;
    } catch (error) {
        console.error('[WhatsApp] Error sending message:', error);
        return false;
    }
}

// ── Public helpers ──────────────────────────────────────────

export async function notifyOrderToWhatsApp(data: {
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    address: string;
    items: { name: string; quantity: number; price: number; color?: string; size?: string }[];
    total: number;
    note?: string;
}): Promise<void> {
    const config = getConfig();
    if (!config) return; // WhatsApp not configured — skip silently

    const itemLines = data.items.map((item, i) => {
        const variant = [item.color, item.size].filter(Boolean).join(' / ');
        return `${i + 1}. ${item.name} × ${item.quantity}${variant ? ` (${variant})` : ''} — ৳${item.price}`;
    }).join('\n');

    const msg = `🛒 *New Order — ${data.orderNumber}*

👤 *Name:* ${data.customerName}
📞 *Phone:* ${data.customerPhone}
📍 *Address:* ${data.address}

📦 *Items:*
${itemLines}

💰 *Total:* ৳${data.total.toLocaleString()}
${data.note ? `📝 *Note:* ${data.note}` : ''}
⏰ ${new Date().toLocaleString('en-BD')}`;

    await sendWhatsAppMessage(config.adminPhone, msg, config);
}

export async function notifyInquiryToWhatsApp(data: {
    customerName: string;
    customerPhone: string;
    productName: string;
    message: string;
    color?: string;
    size?: string;
}): Promise<void> {
    const config = getConfig();
    if (!config) return; // WhatsApp not configured — skip silently

    const variant = [data.color, data.size].filter(Boolean).join(' / ');

    const msg = `❓ *New Inquiry — S Kawsar Sunnah Mart*

👤 *Name:* ${data.customerName}
📞 *Contact:* ${data.customerPhone}
📦 *Product:* ${data.productName}${variant ? `\n🎨 *Variant:* ${variant}` : ''}

💬 *Message:*
${data.message}

⏰ ${new Date().toLocaleString('en-BD')}`;

    await sendWhatsAppMessage(config.adminPhone, msg, config);
}
