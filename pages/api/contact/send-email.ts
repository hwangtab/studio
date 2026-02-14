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

    if (process.env.NODE_ENV === 'production') {
        console.error('[Rate Limit] Vercel KV is not configured in production. Failing closed.');
        throw new Error('RATE_LIMIT_UNAVAILABLE');
    }

    if (!hasLoggedMemoryFallback) {
        console.warn('[Rate Limit] Vercel KV not configured. Using in-memory limiter fallback.');
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const contentType = req.headers['content-type'];
    if (contentType && !String(contentType).toLowerCase().includes('application/json')) {
        return res.status(415).json({ message: 'Content-Type must be application/json' });
    }

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
        return res.status(400).json({ message: 'Invalid request body' });
    }

    const payload = req.body as Record<string, unknown>;

    const { name, phone, email, message, company, utm_source, utm_medium, utm_campaign, referrer } = payload;

    // 1. Honeypot validation
    if (company && typeof company === 'string' && company.trim().length > 0) {
        // Silently ignore honeypot submissions
        return res.status(200).json({ success: true, message: 'Message sent successfully' });
    }

    // 2. CSRF protection - validate origin/referer
    const allowedOrigins = getAllowedOrigins();
    const requestOrigin = normalizeOrigin(String(req.headers.origin || req.headers.referer || ''));
    if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    // 3. Rate limiting by IP
    const rateLimitSubject = getRateLimitSubject(req);

    try {
        await checkRateLimit(rateLimitSubject);
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED') {
            return res.status(429).json({ message: 'Too many requests. Please try again later.' });
        }
        if (error instanceof Error && error.message === 'RATE_LIMIT_UNAVAILABLE') {
            return res.status(503).json({ message: 'Service temporarily unavailable. Please try again later.' });
        }
        console.error('[API Route Error] Rate limit check failed:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }

    // 4. Shared validation
    const contactFields = toContactFormFields({ name, phone, email, message });
    const validationResult = validateContactForm(contactFields);
    const firstValidationError = getFirstContactValidationError(validationResult.errors);

    if (firstValidationError) {
        return res.status(400).json({
            message: validationCodeMessageMap[firstValidationError.code],
            field: firstValidationError.field,
            code: firstValidationError.code,
        });
    }

    // Sanitization
    const sanitizedName = validator.escape(validationResult.normalized.name);
    const sanitizedEmail = validator.normalizeEmail(validationResult.normalized.email) || validationResult.normalized.email;
    const sanitizedMessage = validator.escape(validationResult.normalized.message);
    const sanitizedPhone = validator.escape(validationResult.normalized.phone);

    // 5. Send email via EmailJS REST API
    try {
        const serviceId = process.env.EMAILJS_SERVICE_ID;
        const templateId = process.env.EMAILJS_TEMPLATE_ID;
        const publicKey = process.env.EMAILJS_PUBLIC_KEY;
        const privateKey = process.env.EMAILJS_PRIVATE_KEY;

        if (!serviceId || !templateId || !publicKey) {
            console.error('[API Error] Missing EmailJS configuration');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        if (!privateKey) {
            console.warn('[API Warning] EMAILJS_PRIVATE_KEY is not set. If EmailJS requires it (non-browser apps), calls will fail.');
        }

        const payload: EmailJSPayload = {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            template_params: {
                name: sanitizedName,
                phone: sanitizedPhone,
                email: sanitizedEmail,
                message: sanitizedMessage,
                utm_source: typeof utm_source === 'string' ? utm_source : undefined,
                utm_medium: typeof utm_medium === 'string' ? utm_medium : undefined,
                utm_campaign: typeof utm_campaign === 'string' ? utm_campaign : undefined,
                referrer: typeof referrer === 'string' ? referrer : undefined,
            },
        };

        if (privateKey) {
            payload.accessToken = privateKey;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
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

        if (response.ok) {
            return res.status(200).json({ success: true, message: 'Message sent successfully' });
        } else {
            const errorText = await response.text();
            // Log full error on server, but send generic message to client
            console.error('[EmailJS Error]', {
                status: response.status,
                error: errorText,
                serviceId
            });
            // Map external service errors to 502 Bad Gateway to distinguish from internal CSRF 403
            return res.status(502).json({
                message: 'Failed to send message. Please try again later.'
            });
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return res.status(504).json({ message: 'Email service timeout. Please try again later.' });
        }
        console.error('[API Route Error]', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
