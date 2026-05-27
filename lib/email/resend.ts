const RESEND_API_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_FROM = 'Studio NOL <noreply@studionol.co.kr>';

export type SendEmailError =
    | 'RESEND_API_KEY_MISSING'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'API_ERROR';

interface SendEmailParams {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
}

export interface SendEmailResult {
    ok: boolean;
    status?: number;
    errorCode?: SendEmailError;
    errorDetail?: string;
}

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
