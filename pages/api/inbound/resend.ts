import type { NextApiRequest, NextApiResponse } from 'next';

import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { includesAlias, parseEmailAddress, verifySvixSignature } from '../../../lib/email/inboundWebhook';

/**
 * hello@studionol.co.kr 수신함.
 *
 * 도메인 MX가 Resend 수신으로 잡혀 있고, 메일이 도착하면 Resend가 이 엔드포인트로
 * `email.received` 웹훅을 쏜다. 여기서 원문(본문·첨부)을 Resend API로 받아와
 * FORWARD_TO(운영자 Gmail)로 재발송한다. Reply-To를 원발신자로 세팅하므로
 * Gmail에서 그냥 "답장"을 누르면 상대에게 간다.
 *
 * 실패 시 5xx를 돌려주면 svix가 지수 백오프로 재시도하므로, 일시 장애는 재시도에
 * 맡기고 "정상적으로 무시한 요청"만 200으로 끝낸다.
 */

const RESEND_API_BASE = 'https://api.resend.com';
const INBOUND_ALIAS = 'hello@studionol.co.kr';
const FORWARD_TO = OPERATOR_EMAIL;
/** Resend 발송 요청 한도(40MB)를 넘지 않도록 첨부 합계를 제한한다 */
const MAX_TOTAL_ATTACHMENT_BYTES = 30 * 1024 * 1024;

// svix 서명은 파싱 전 원문 바디로 검증해야 하므로 Next의 JSON 파서를 끈다.
export const config = { api: { bodyParser: false } };

interface ReceivedEmailAttachmentMeta {
    id: string;
    filename: string | null;
    size: number;
    content_type: string;
    content_id: string | null;
}

interface ReceivedEmail {
    id: string;
    from: string;
    to: string[];
    cc: string[] | null;
    received_for: string[];
    subject: string;
    html: string | null;
    text: string | null;
    attachments: ReceivedEmailAttachmentMeta[];
}

interface OutgoingAttachment {
    filename: string;
    content: string;
    content_type: string;
    content_id?: string;
}

const readRawBody = async (req: NextApiRequest): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
};

const headerValue = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

const resendGet = async (apiKey: string, path: string): Promise<Response> =>
    fetch(`${RESEND_API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
    });

/**
 * 첨부를 하나씩 받아 base64로 담는다. 개별 실패나 용량 초과는 메일 유실보다
 * 낫도록 건너뛰고, 건너뛴 목록을 본문에 덧붙일 수 있게 돌려준다.
 */
const collectAttachments = async (
    apiKey: string,
    emailId: string,
    metas: ReceivedEmailAttachmentMeta[],
): Promise<{ attachments: OutgoingAttachment[]; skipped: string[] }> => {
    const attachments: OutgoingAttachment[] = [];
    const skipped: string[] = [];
    let totalBytes = 0;

    for (const meta of metas) {
        const label = meta.filename || meta.id;
        if (totalBytes + meta.size > MAX_TOTAL_ATTACHMENT_BYTES) {
            skipped.push(label);
            continue;
        }
        try {
            const metaResponse = await resendGet(apiKey, `/emails/receiving/${emailId}/attachments/${meta.id}`);
            if (!metaResponse.ok) {
                skipped.push(label);
                continue;
            }
            const { download_url: downloadUrl } = (await metaResponse.json()) as { download_url?: string };
            if (!downloadUrl) {
                skipped.push(label);
                continue;
            }
            const fileResponse = await fetch(downloadUrl, { cache: 'no-store' });
            if (!fileResponse.ok) {
                skipped.push(label);
                continue;
            }
            const buffer = Buffer.from(await fileResponse.arrayBuffer());
            totalBytes += buffer.length;
            attachments.push({
                filename: meta.filename || 'attachment',
                content: buffer.toString('base64'),
                content_type: meta.content_type,
                content_id: meta.content_id?.replace(/^<|>$/g, '') || undefined,
            });
        } catch {
            skipped.push(label);
        }
    }

    return { attachments, skipped };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const apiKey = process.env.RESEND_API_KEY;
    if (!webhookSecret || !apiKey) {
        console.error('[Inbound] Missing RESEND_WEBHOOK_SECRET or RESEND_API_KEY');
        return res.status(500).json({ message: 'Server configuration error' });
    }

    const rawBody = await readRawBody(req);
    const verification = verifySvixSignature({
        payload: rawBody,
        svixId: headerValue(req.headers['svix-id']),
        svixTimestamp: headerValue(req.headers['svix-timestamp']),
        svixSignature: headerValue(req.headers['svix-signature']),
        secret: webhookSecret,
    });
    if (!verification.ok) {
        console.warn(`[Inbound] Rejected webhook: ${verification.reason}`);
        return res.status(401).json({ message: 'Invalid signature' });
    }

    let event: { type?: string; data?: { email_id?: string } };
    try {
        event = JSON.parse(rawBody);
    } catch {
        return res.status(400).json({ message: 'Invalid JSON' });
    }

    if (event.type !== 'email.received' || !event.data?.email_id) {
        return res.status(200).json({ ignored: true });
    }

    const emailResponse = await resendGet(apiKey, `/emails/receiving/${event.data.email_id}`);
    if (!emailResponse.ok) {
        console.error(`[Inbound] Failed to fetch received email: ${emailResponse.status}`);
        return res.status(502).json({ message: 'Failed to fetch received email' });
    }
    const email = (await emailResponse.json()) as ReceivedEmail;

    const recipients = [...email.to, ...(email.cc ?? []), ...email.received_for];
    if (!includesAlias(recipients, INBOUND_ALIAS)) {
        // 전용 주소 앞으로 온 메일만 전달한다. 나머지는 Resend 대시보드에 남는다.
        return res.status(200).json({ ignored: true });
    }

    const sender = parseEmailAddress(email.from);
    if (sender.address.toLowerCase() === INBOUND_ALIAS) {
        // 포워딩 메일이 되돌아오는 루프 차단
        return res.status(200).json({ ignored: true });
    }

    const { attachments, skipped } = await collectAttachments(apiKey, email.id, email.attachments ?? []);

    const skippedNotice =
        skipped.length > 0
            ? `\n\n---\n[Studio NOL 수신함] 용량·오류로 전달하지 못한 첨부 ${skipped.length}건: ${skipped.join(', ')} — Resend 대시보드에서 확인하세요.`
            : '';
    const text = (email.text ?? '') + skippedNotice || undefined;
    const html = email.html
        ? email.html + (skippedNotice ? `<hr><p>${skippedNotice.trim()}</p>` : '')
        : undefined;

    const forwardResponse = await fetch(`${RESEND_API_BASE}/emails`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            from: `${sender.displayName} <${INBOUND_ALIAS}>`,
            to: [FORWARD_TO],
            reply_to: email.from,
            subject: email.subject || '(제목 없음)',
            text: text ?? (html ? undefined : '(본문 없음)'),
            html,
            attachments: attachments.length > 0 ? attachments : undefined,
        }),
        cache: 'no-store',
    });

    if (!forwardResponse.ok) {
        const detail = await forwardResponse.text().catch(() => '');
        console.error(`[Inbound] Forward failed: ${forwardResponse.status} ${detail}`);
        return res.status(502).json({ message: 'Forward failed' });
    }

    return res.status(200).json({ forwarded: true });
}
