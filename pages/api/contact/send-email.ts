import type { NextApiRequest, NextApiResponse } from 'next';
import validator from 'validator';

import { kv } from '@vercel/kv';

// Rate limiting configuration
const LIMIT = 5; // max 5 requests
const WINDOW = 15 * 60; // 15 minutes in seconds (KV uses seconds for TTL)
const PRODUCTION_ORIGIN = 'https://studionol.co.kr';

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
    return socketIP || 'unknown';
}

const getAllowedOrigins = (): string[] => {
    const envOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => normalizeOrigin(origin.trim()))
        .filter((origin): origin is string => Boolean(origin));

    const defaults = [
        normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL || ''),
        PRODUCTION_ORIGIN,
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

const checkRateLimitInMemory = (ip: string): void => {
    const key = `rate_limit_contact:${ip}`;
    const now = Date.now();
    const expiresAt = now + WINDOW * 1000;
    pruneExpiredInMemoryEntries(now);
    const existing = memoryRateLimitStore.get(key);

    if (!existing || existing.expiresAt <= now) {
        memoryRateLimitStore.set(key, { count: 1, expiresAt });
        return;
    }

    const nextCount = existing.count + 1;
    if (nextCount > LIMIT) {
        throw new Error('RATE_LIMIT_EXCEEDED');
    }

    memoryRateLimitStore.set(key, { count: nextCount, expiresAt: existing.expiresAt });
};

async function checkRateLimit(ip: string): Promise<void> {
    const isKvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

    // Vercel KV is required for production rate limiting
    if (isKvConfigured) {
        try {
            const key = `rate_limit_contact:${ip}`;
            const count = await kv.incr(key);

            if (count === 1) {
                await kv.expire(key, WINDOW);
            }

            if (count > LIMIT) {
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
            checkRateLimitInMemory(ip);
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

    checkRateLimitInMemory(ip);
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
    const ip = getClientIP(req);

    try {
        await checkRateLimit(ip);
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

    // 4. Enhanced validation & sanitization
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedMessage = typeof message === 'string' ? message.trim() : '';

    // Name validation: 2-100 chars, Unicode letters + spaces + hyphens + apostrophes
    if (!name || typeof name !== 'string' || validator.isEmpty(normalizedName)) {
        return res.status(400).json({ message: 'Name is required', field: 'name' });
    }
    if (!validator.isLength(normalizedName, { min: 2, max: 100 })) {
        return res.status(400).json({ message: 'Name must be 2-100 characters', field: 'name' });
    }
    if (!validator.matches(normalizedName, /^[\p{L}\p{M}\s'-]+$/u)) {
        return res.status(400).json({ message: 'Name contains invalid characters', field: 'name' });
    }

    // Email validation: standard email + max 254 chars
    if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        return res.status(400).json({ message: 'Valid email is required', field: 'email' });
    }
    if (!validator.isLength(email, { min: 1, max: 254 })) {
        return res.status(400).json({ message: 'Email must not exceed 254 characters', field: 'email' });
    }

    // Phone validation (required): normalize whitespace, then validate (supports international format with +)
    if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ message: 'Phone is required', field: 'phone' });
    }
    const normalizedPhone = phone.replace(/\s/g, '');
    if (!normalizedPhone) {
        return res.status(400).json({ message: 'Phone contains only whitespace', field: 'phone' });
    }
    if (!validator.isLength(normalizedPhone, { min: 5, max: 50 })) {
        return res.status(400).json({ message: 'Phone must be 5-50 characters', field: 'phone' });
    }
    if (!validator.matches(normalizedPhone, /^[\d\s+\-\(\)]+$/)) {
        return res.status(400).json({ message: 'Phone contains invalid characters', field: 'phone' });
    }

    // Message validation: 10-5000 chars
    if (!message || typeof message !== 'string' || validator.isEmpty(normalizedMessage)) {
        return res.status(400).json({ message: 'Message is required', field: 'message' });
    }
    if (!validator.isLength(normalizedMessage, { min: 10, max: 5000 })) {
        return res.status(400).json({ message: 'Message must be 10-5000 characters', field: 'message' });
    }

    // Sanitization
    const sanitizedName = validator.escape(normalizedName);
    const sanitizedEmail = validator.normalizeEmail(email.trim()) || email.trim();
    const sanitizedMessage = validator.escape(normalizedMessage);
    const sanitizedPhone = normalizedPhone ? validator.escape(String(normalizedPhone).trim()) : undefined;

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
            // Include error text for debugging in this phase
            return res.status(502).json({
                message: `EmailJS Error: ${errorText}`
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
