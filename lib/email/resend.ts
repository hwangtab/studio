const RESEND_API_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_FROM = 'Studio NOL <noreply@studionol.co.kr>';

export type SendEmailError =
    | 'RESEND_API_KEY_MISSING'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'API_ERROR'
    /** 보내 봐야 반송될 주소라 발송하지 않았다 */
    | 'UNDELIVERABLE_ADDRESS';

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

/**
 * 실제로 배달될 수 없는 주소.
 *
 * RFC 2606이 예시·시험용으로 예약해 둔 도메인들은 메일 서버가 없어 보내면 그대로 반송된다.
 * 반송이 쌓이면 발신 도메인 평판이 깎이고, 그 대가는 진짜 고객의 메일이 스팸함으로 가는
 * 형태로 돌아온다. 시험용 주소가 어떤 경로로든 흘러들어도 발송 자체를 하지 않는다.
 */
const UNDELIVERABLE_DOMAIN = /@(?:example\.(?:com|net|org)|test|invalid|localhost)$/i;

export function isUndeliverableAddress(address: string): boolean {
    return UNDELIVERABLE_DOMAIN.test(address.trim());
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (isUndeliverableAddress(params.to)) {
        console.warn(`[Email] Skipped undeliverable address: ${params.to}`);
        return { ok: false, errorCode: 'UNDELIVERABLE_ADDRESS' };
    }

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
