import type { NextApiRequest, NextApiResponse } from 'next';
import validator from 'validator';
import { createHash } from 'crypto';

import { kv } from '@vercel/kv';
import { sendEmail } from '../../../lib/email/resend';
import {
    getFirstContactValidationError,
    toContactFormFields,
    validateContactForm,
    type ContactValidationCode,
} from '../../../utils/contactValidation';

// Rate limiting configuration
const LIMIT = 5; // max 5 requests
const WINDOW = 15 * 60; // 15 minutes in seconds (KV uses seconds for TTL)
const UNKNOWN_IP_LIMIT = 3; // stricter limit for low-trust fallback identifiers
const UNKNOWN_IP_WINDOW = 2 * 60; // short TTL to avoid long lockouts on collisions
const PRODUCTION_ORIGIN = 'https://studionol.co.kr';
const PRODUCTION_WWW_ORIGIN = 'https://www.studionol.co.kr';
const UNKNOWN_IP_KEY = 'unknown';

interface RateLimitSubject {
    key: string;
    limit: number;
    windowSeconds: number;
}

interface MemoryRateLimitEntry {
    count: number;
    expiresAt: number;
}

const memoryRateLimitStore = new Map<string, MemoryRateLimitEntry>();
let hasLoggedMemoryFallback = false;

const toHeaderCandidates = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const normalizeIP = (value: string): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const deBracketed = trimmed.startsWith('[') && trimmed.endsWith(']')
        ? trimmed.slice(1, -1)
        : trimmed;
    const strippedPort = deBracketed.includes('.') ? deBracketed.replace(/:\d+$/, '') : deBracketed;
    const normalized = strippedPort.startsWith('::ffff:') ? strippedPort.slice(7) : strippedPort;

    return validator.isIP(normalized) ? normalized : null;
};

const getFirstValidIP = (value: string | string[] | undefined): string | null => {
    const candidates = toHeaderCandidates(value);
    for (const candidate of candidates) {
        const ip = normalizeIP(candidate);
        if (ip) return ip;
    }
    return null;
};

const normalizeOrigin = (value: string): string | null => {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

// Extract client IP with Vercel-aware header priority
function getClientIP(req: NextApiRequest): string {
    const vercelIP = getFirstValidIP(req.headers['x-vercel-forwarded-for']);
    if (vercelIP) return vercelIP;

    const realIP = getFirstValidIP(req.headers['x-real-ip']);
    if (realIP) return realIP;

    const forwardedIP = getFirstValidIP(req.headers['x-forwarded-for']);
    if (forwardedIP) return forwardedIP;

    const socketIP = normalizeIP(req.socket.remoteAddress || '');
    return socketIP || UNKNOWN_IP_KEY;
}

function buildFallbackFingerprint(req: NextApiRequest): string {
    const userAgent = String(req.headers['user-agent'] || '');
    const acceptLanguage = String(req.headers['accept-language'] || '');
    const secChUa = String(req.headers['sec-ch-ua'] || '');
    const secChUaPlatform = String(req.headers['sec-ch-ua-platform'] || '');
    const host = String(req.headers.host || '');

    const fingerprintSource = [
        userAgent.trim().toLowerCase(),
        acceptLanguage.trim().toLowerCase(),
        secChUa.trim().toLowerCase(),
        secChUaPlatform.trim().toLowerCase(),
        host.trim().toLowerCase(),
    ].join('|');

    return createHash('sha256').update(fingerprintSource).digest('hex').slice(0, 24);
}

function getRateLimitSubject(req: NextApiRequest): RateLimitSubject {
    const ip = getClientIP(req);
    if (ip !== UNKNOWN_IP_KEY) {
        return {
            key: `ip:${ip}`,
            limit: LIMIT,
            windowSeconds: WINDOW,
        };
    }

    const fingerprint = buildFallbackFingerprint(req);
    return {
        key: `fp:${fingerprint}`,
        limit: UNKNOWN_IP_LIMIT,
        windowSeconds: UNKNOWN_IP_WINDOW,
    };
}

const getAllowedOrigins = (): string[] => {
    const envOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => normalizeOrigin(origin.trim()))
        .filter((origin): origin is string => Boolean(origin));

    const defaults = [
        normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL || ''),
        PRODUCTION_ORIGIN,
        PRODUCTION_WWW_ORIGIN,
        process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null,
        process.env.NODE_ENV !== 'production' ? 'http://localhost:3001' : null,
    ]
        .filter((origin): origin is string => Boolean(origin))
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin));

    return [...new Set([...defaults, ...envOrigins])];
};

const pruneExpiredInMemoryEntries = (now: number): void => {
    for (const [key, entry] of memoryRateLimitStore.entries()) {
        if (entry.expiresAt <= now) {
            memoryRateLimitStore.delete(key);
        }
    }
};

const checkRateLimitInMemory = (subject: RateLimitSubject): void => {
    const key = `rate_limit_contact:${subject.key}`;
    const now = Date.now();
    const expiresAt = now + subject.windowSeconds * 1000;
    pruneExpiredInMemoryEntries(now);
    const existing = memoryRateLimitStore.get(key);

    if (!existing || existing.expiresAt <= now) {
        memoryRateLimitStore.set(key, { count: 1, expiresAt });
        return;
    }

    const nextCount = existing.count + 1;
    if (nextCount > subject.limit) {
        throw new Error('RATE_LIMIT_EXCEEDED');
    }

    memoryRateLimitStore.set(key, { count: nextCount, expiresAt: existing.expiresAt });
};

async function checkRateLimit(subject: RateLimitSubject): Promise<void> {
    const isKvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

    // Vercel KV is required for production rate limiting
    if (isKvConfigured) {
        try {
            const key = `rate_limit_contact:${subject.key}`;
            const count = await kv.incr(key);

            if (count === 1) {
                await kv.expire(key, subject.windowSeconds);
            }

            if (count > subject.limit) {
                throw new Error('RATE_LIMIT_EXCEEDED');
            }
            return;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED') throw error;

            console.error('[Rate Limit] Vercel KV failed:', error);
            // KV가 설정됐지만 런타임에 실패한 경우 환경 무관하게 fail-closed.
            // (KV 미설정 개발환경은 아래 별도 경로에서 in-memory fallback 허용)
            throw new Error('RATE_LIMIT_UNAVAILABLE');
        }
    }

    // 프로덕션에서는 KV 설정이 필수. 미설정이면 인스턴스별 카운터 우회가 가능하므로 503 반환.
    if (process.env.NODE_ENV === 'production') {
        console.error('[Rate Limit] Vercel KV not configured in production. Set KV_REST_API_URL and KV_REST_API_TOKEN.');
        throw new Error('RATE_LIMIT_UNAVAILABLE');
    }

    // 개발환경 in-memory fallback
    if (!hasLoggedMemoryFallback) {
        console.warn('[Rate Limit] Vercel KV not configured (dev). Using in-memory limiter fallback.');
        hasLoggedMemoryFallback = true;
    }

    checkRateLimitInMemory(subject);
    return;
}

interface SanitizedContactPayload {
    name: string;
    phone: string;
    email: string;
    message: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referrer?: string;
}

const CONTACT_TO = 'hwangtab@gmail.com';
const SUCCESS_RESPONSE = { success: true, message: 'Message sent successfully' };

const validationCodeMessageMap: Record<ContactValidationCode, string> = {
    name_required: 'Name is required',
    name_min: 'Name must be 2-100 characters',
    name_max: 'Name must be 2-100 characters',
    name_invalid: 'Name contains invalid characters',
    email_required: 'Valid email is required',
    email_invalid: 'Valid email is required',
    email_max: 'Email must not exceed 254 characters',
    phone_required: 'Phone is required',
    phone_invalid: 'Phone contains invalid characters',
    phone_length: 'Phone must be 5-50 characters',
    message_required: 'Message is required',
    message_min: 'Message must be 10-5000 characters',
    message_max: 'Message must be 10-5000 characters',
};

const toSafeOptionalString = (value: unknown, maxLength = 255): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, maxLength);
    return trimmed || undefined;
};

const getRequestPayload = (req: NextApiRequest, res: NextApiResponse): Record<string, unknown> | null => {
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed' });
        return null;
    }

    const contentType = req.headers['content-type'];
    if (contentType && !String(contentType).toLowerCase().includes('application/json')) {
        res.status(415).json({ message: 'Content-Type must be application/json' });
        return null;
    }

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
        res.status(400).json({ message: 'Invalid request body' });
        return null;
    }

    return req.body as Record<string, unknown>;
};

const isHoneypotSubmission = (company: unknown): boolean =>
    typeof company === 'string' && company.trim().length > 0;

const MIN_FILL_MS = 3000;

const isTooFast = (formLoadTime: unknown): boolean => {
    if (typeof formLoadTime !== 'number' || !Number.isFinite(formLoadTime)) return false;
    return Date.now() - formLoadTime < MIN_FILL_MS;
};

const isAllowedRequestOrigin = (req: NextApiRequest): boolean => {
    const allowedOrigins = getAllowedOrigins();
    const requestOrigin = normalizeOrigin(String(req.headers.origin || req.headers.referer || ''));
    return Boolean(requestOrigin && allowedOrigins.includes(requestOrigin));
};

const enforceRateLimit = async (req: NextApiRequest, res: NextApiResponse): Promise<boolean> => {
    const rateLimitSubject = getRateLimitSubject(req);

    try {
        await checkRateLimit(rateLimitSubject);
        return true;
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED') {
            res.status(429).json({ message: 'Too many requests. Please try again later.' });
            return false;
        }
        if (error instanceof Error && error.message === 'RATE_LIMIT_UNAVAILABLE') {
            res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' });
            return false;
        }
        console.error('[API Route Error] Rate limit check failed:', error);
        res.status(500).json({ message: 'Internal server error' });
        return false;
    }
};

const validateAndSanitizeContactPayload = (
    payload: Record<string, unknown>
): {
    validationError?: { field: string; code: ContactValidationCode; message: string };
    sanitized?: SanitizedContactPayload;
} => {
    const contactFields = toContactFormFields({
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        message: payload.message,
    });
    const validationResult = validateContactForm(contactFields);
    const firstValidationError = getFirstContactValidationError(validationResult.errors);

    if (firstValidationError) {
        return {
            validationError: {
                field: firstValidationError.field,
                code: firstValidationError.code,
                message: validationCodeMessageMap[firstValidationError.code],
            },
        };
    }

    return {
        sanitized: {
            name: validationResult.normalized.name,
            email: validator.normalizeEmail(validationResult.normalized.email) || validationResult.normalized.email,
            message: validationResult.normalized.message,
            phone: validationResult.normalized.phone,
            utm_source: toSafeOptionalString(payload.utm_source),
            utm_medium: toSafeOptionalString(payload.utm_medium),
            utm_campaign: toSafeOptionalString(payload.utm_campaign),
            referrer: toSafeOptionalString(payload.referrer, 2048),
        },
    };
};

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildContactEmailHtml = (sanitized: SanitizedContactPayload): string => {
    const name = escapeHtml(sanitized.name);
    const email = escapeHtml(sanitized.email);
    const phone = escapeHtml(sanitized.phone);
    const message = escapeHtml(sanitized.message).replace(/\n/g, '<br>');

    const fieldRow = (label: string, value: string, link?: string) => `
        <tr>
          <td style="padding:6px 0 2px;font-size:11px;font-weight:600;letter-spacing:.06em;
                     text-transform:uppercase;color:#6b7280;">
            ${label}
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 18px;font-size:15px;color:#1f2937;">
            ${link ? `<a href="${link}" style="color:#6d28d9;text-decoration:none;">${value}</a>` : value}
          </td>
        </tr>`;

    const attributionLines: string[] = [];
    if (sanitized.utm_source) attributionLines.push(`utm_source: ${escapeHtml(sanitized.utm_source)}`);
    if (sanitized.utm_medium) attributionLines.push(`utm_medium: ${escapeHtml(sanitized.utm_medium)}`);
    if (sanitized.utm_campaign) attributionLines.push(`utm_campaign: ${escapeHtml(sanitized.utm_campaign)}`);
    if (sanitized.referrer) attributionLines.push(`referrer: ${escapeHtml(sanitized.referrer)}`);

    const attributionBlock = attributionLines.length > 0 ? `
        <tr>
          <td style="padding:18px 0 0;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              ${attributionLines.join(' &nbsp;·&nbsp; ')}
            </p>
          </td>
        </tr>` : '';

    return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">

  <!-- 프리헤더 (받은편지함 미리보기) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f9fafb;">
    ${name}님의 새 문의가 도착했습니다.&nbsp;‌&zwnj;​&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;
                      border-radius:12px;border:1px solid #e5e7eb;
                      overflow:hidden;">

          <!-- 헤더 -->
          <tr>
            <td bgcolor="#6d28d9"
                style="background-image:linear-gradient(135deg,#6d28d9 0%,#be185d 100%);
                       padding:36px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;
                        letter-spacing:-.01em;">
                스튜디오 놀
              </p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,.8);letter-spacing:.02em;">
                새 문의가 도착했습니다
              </p>
            </td>
          </tr>

          <!-- 본문 -->
          <tr>
            <td style="padding:32px 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${fieldRow('이름', name)}
                ${fieldRow('이메일', email, `mailto:${encodeURIComponent(sanitized.email)}`)}
                ${fieldRow('전화', phone, `tel:${encodeURIComponent(sanitized.phone)}`)}
                <tr>
                  <td style="padding:6px 0 8px;font-size:11px;font-weight:600;letter-spacing:.06em;
                             text-transform:uppercase;color:#6b7280;">
                    메시지
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 8px;">
                    <div style="background:#f9fafb;border-left:3px solid #6d28d9;
                                border-radius:6px;padding:16px 18px;
                                font-size:15px;line-height:1.7;color:#1f2937;
                                white-space:pre-wrap;word-break:break-word;">
                      ${message}
                    </div>
                  </td>
                </tr>
                ${attributionBlock}
              </table>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                       padding:20px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;line-height:1.6;">
                <strong style="color:#6b7280;">스튜디오 놀</strong>
                &nbsp;·&nbsp; 서울특별시 은평구 대조동 84-3 3층
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="tel:050713843144" style="color:#9ca3af;text-decoration:none;">
                  0507-1384-3144
                </a>
                &nbsp;·&nbsp;
                <a href="https://studionol.co.kr" style="color:#6d28d9;text-decoration:none;">
                  studionol.co.kr
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};

const buildContactEmailBody = (sanitized: SanitizedContactPayload): string => {
    const lines: string[] = [
        `이름: ${sanitized.name}`,
        `이메일: ${sanitized.email}`,
        `전화: ${sanitized.phone}`,
        '',
        '메시지:',
        sanitized.message,
    ];

    const attribution: string[] = [];
    if (sanitized.utm_source) attribution.push(`utm_source=${sanitized.utm_source}`);
    if (sanitized.utm_medium) attribution.push(`utm_medium=${sanitized.utm_medium}`);
    if (sanitized.utm_campaign) attribution.push(`utm_campaign=${sanitized.utm_campaign}`);
    if (sanitized.referrer) attribution.push(`referrer=${sanitized.referrer}`);

    if (attribution.length > 0) {
        lines.push('', '---', attribution.join('  |  '));
    }

    return lines.join('\n');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');

    const payload = getRequestPayload(req, res);
    if (!payload) {
        return;
    }

    // 1. Honeypot validation (필드 채워짐 + 너무 빠른 제출 모두 조용히 무시)
    if (isHoneypotSubmission(payload.company) || isTooFast(payload._formLoadTime)) {
        return res.status(200).json(SUCCESS_RESPONSE);
    }

    // 2. CSRF protection - validate origin/referer
    if (!isAllowedRequestOrigin(req)) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    // 3. Rate limiting by IP
    if (!(await enforceRateLimit(req, res))) {
        return;
    }

    // 4. Shared validation
    const { validationError, sanitized } = validateAndSanitizeContactPayload(payload);
    if (validationError) {
        return res.status(400).json({
            message: validationError.message,
            field: validationError.field,
            code: validationError.code,
        });
    }

    if (!sanitized) {
        return res.status(500).json({ message: 'Internal server error' });
    }

    // 5. Send email via Resend
    const emailBody = buildContactEmailBody(sanitized);
    const result = await sendEmail({
        to: CONTACT_TO,
        subject: `[Studio NOL] 새 문의 — ${sanitized.name}`,
        html: buildContactEmailHtml(sanitized),
        text: emailBody,
        replyTo: sanitized.email,
    });

    if (result.errorCode === 'RESEND_API_KEY_MISSING') {
        console.error('[API Error] Missing Resend configuration');
        return res.status(500).json({ message: 'Server configuration error' });
    }

    if (result.errorCode === 'TIMEOUT') {
        return res.status(504).json({ message: 'Email service timeout. Please try again later.' });
    }

    if (result.errorCode === 'NETWORK_ERROR') {
        console.error('[API Route Error] Resend network error:', result.errorDetail);
        return res.status(500).json({ message: 'Internal server error' });
    }

    if (!result.ok) {
        console.error('[Resend Error]', { status: result.status, detail: result.errorDetail });
        return res.status(502).json({ message: 'Failed to send message. Please try again later.' });
    }

    return res.status(200).json(SUCCESS_RESPONSE);
}
