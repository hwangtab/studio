const RESEND_API_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_FROM = 'Studio NOL <noreply@studionol.co.kr>';

export type SendEmailError =
    | 'RESEND_API_KEY_MISSING'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'API_ERROR';

interface SendEmailAttachment {
    filename: string;
    content: string;
}

interface SendEmailParams {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    attachments?: SendEmailAttachment[];
}

export interface SendEmailResult {
    ok: boolean;
    status?: number;
    errorCode?: SendEmailError;
    errorDetail?: string;
}

const escapeHtml = (unsafe: string): string =>
    unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

export const buildEmailHtml = (parts: { title: string; body: string; footer?: string }): string => {
    return `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #111;">${escapeHtml(parts.title)}</h2>
      ${parts.body}
      ${parts.footer ? `<p style="font-size: 12px; color: #999; margin-top: 24px;">${escapeHtml(parts.footer)}</p>` : ''}
    </div>
  `;
};

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return { ok: false, errorCode: 'RESEND_API_KEY_MISSING' };
    }

    const from = process.env.RESEND_FROM || DEFAULT_FROM;

    const body: Record<string, unknown> = {
        from,
        to: [params.to],
        subject: params.subject,
    };

    if (params.replyTo) body.reply_to = params.replyTo;
    if (params.html) body.html = params.html;
    if (params.text) body.text = params.text;
    if (params.attachments && params.attachments.length > 0) {
        body.attachments = params.attachments;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMAIL_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(RESEND_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            cache: 'no-store',
            signal: controller.signal,
        });

        if (response.ok) {
            return { ok: true, status: response.status };
        }

        const errorDetail = await response.text().catch(() => '');
        return { ok: false, status: response.status, errorCode: 'API_ERROR', errorDetail };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return { ok: false, errorCode: 'TIMEOUT' };
        }
        return {
            ok: false,
            errorCode: 'NETWORK_ERROR',
            errorDetail: error instanceof Error ? error.message : String(error),
        };
    } finally {
        clearTimeout(timeoutId);
    }
}
