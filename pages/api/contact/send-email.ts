import type { NextApiRequest, NextApiResponse } from 'next';
import validator from 'validator';
import { createHash } from 'crypto';

import { kv } from '@vercel/kv';
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
            if (process.env.NODE_ENV === 'production') {
                throw new Error('RATE_LIMIT_UNAVAILABLE');
            }
            if (!hasLoggedMemoryFallback) {
                console.warn('[Rate Limit] Falling back to in-memory limiter due to KV failure.');
                hasLoggedMemoryFallback = true;
            }
            checkRateLimitInMemory(subject);
            return;
        }
    }

    // KV 비활성화 시 in-memory fallback. 저트래픽 사이트에서 region-local 카운터로 충분.
    if (!hasLoggedMemoryFallback) {
        const where = process.env.NODE_ENV === 'production' ? 'production' : 'dev';
        console.warn(`[Rate Limit] Vercel KV not configured (${where}). Using in-memory limiter fallback.`);
        hasLoggedMemoryFallback = true;
    }

    checkRateLimitInMemory(subject);
    return;
}

interface EmailJSPayload {
    service_id: string;
    template_id: string;
    user_id: string;
    template_params: {
        name: string;
        phone?: string;
        email: string;
        message: string;
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
        referrer?: string;
    };
    accessToken?: string;
}

interface EmailJSConfig {
    serviceId: string;
    templateId: string;
    publicKey: string;
    privateKey?: string;
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

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const EMAIL_REQUEST_TIMEOUT_MS = 12000;
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

const getEmailJsConfig = (): EmailJSConfig | null => {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey) {
        return null;
    }

    if (!privateKey) {
        console.warn('[API Warning] EMAILJS_PRIVATE_KEY is not set. If EmailJS requires it (non-browser apps), calls will fail.');
    }

    return {
        serviceId,
        templateId,
        publicKey,
        privateKey: privateKey || undefined,
    };
};

const buildEmailJsPayload = (config: EmailJSConfig, sanitized: SanitizedContactPayload): EmailJSPayload => {
    const payload: EmailJSPayload = {
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: {
            name: sanitized.name,
            phone: sanitized.phone,
            email: sanitized.email,
            message: sanitized.message,
            utm_source: sanitized.utm_source,
            utm_medium: sanitized.utm_medium,
            utm_campaign: sanitized.utm_campaign,
            referrer: sanitized.referrer,
        },
    };

    if (config.privateKey) {
        payload.accessToken = config.privateKey;
    }

    return payload;
};

const sendEmailJsRequest = async (payload: EmailJSPayload): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMAIL_REQUEST_TIMEOUT_MS);

    return fetch(EMAILJS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
    }).finally(() => {
        clearTimeout(timeoutId);
    });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');

    const payload = getRequestPayload(req, res);
    if (!payload) {
        return;
    }

    // 1. Honeypot validation
    if (isHoneypotSubmission(payload.company)) {
        // Silently ignore honeypot submissions
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

    // 5. Send email via EmailJS REST API
    const emailJsConfig = getEmailJsConfig();
    if (!emailJsConfig) {
        console.error('[API Error] Missing EmailJS configuration');
        return res.status(500).json({ message: 'Server configuration error' });
    }

    const emailJsPayload = buildEmailJsPayload(emailJsConfig, sanitized);

    try {
        const response = await sendEmailJsRequest(emailJsPayload);

        if (response.ok) {
            return res.status(200).json(SUCCESS_RESPONSE);
        }

        const errorText = await response.text();
        // Log full error on server, but send generic message to client
        console.error('[EmailJS Error]', {
            status: response.status,
            error: errorText,
            serviceId: emailJsConfig.serviceId
        });
        // Map external service errors to 502 Bad Gateway to distinguish from internal CSRF 403
        return res.status(502).json({
            message: 'Failed to send message. Please try again later.'
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return res.status(504).json({ message: 'Email service timeout. Please try again later.' });
        }
        console.error('[API Route Error]', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
