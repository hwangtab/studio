import type { NextApiRequest, NextApiResponse } from 'next';
import validator from 'validator';

import { kv } from '@vercel/kv';

// Rate limiting configuration
const LIMIT = 5; // max 5 requests
const WINDOW = 15 * 60; // 15 minutes in seconds (KV uses seconds for TTL)

// Extract client IP with proper header priority to prevent rate limit bypass
function getClientIP(req: NextApiRequest): string {
  // 1. x-real-ip (Vercel and most proxies use this)
  const realIP = req.headers['x-real-ip'];
  if (realIP && typeof realIP === 'string') {
    return realIP.trim();
  }

  // 2. x-forwarded-for (comma-separated list, take first IP only)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const firstIP = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : forwarded[0].trim();
    if (firstIP) return firstIP;
  }

  // 3. Direct socket connection (fallback)
  return req.socket.remoteAddress || 'unknown';
}

// CSRF protection - allowed origins
const ALLOWED_ORIGINS = [
    'https://studionol.co.kr',
    'http://localhost:3000',
    'http://localhost:3001',
];

async function checkRateLimit(ip: string): Promise<void> {
    // Vercel KV is required for production rate limiting
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
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
                throw new Error('RATE_LIMIT_INFRASTRUCTURE_ERROR');
            }
            return;
        }
    }

    if (process.env.NODE_ENV === 'production') {
        console.error('[Rate Limit] Vercel KV not configured in production!');
        throw new Error('RATE_LIMIT_CONFIG_ERROR');
    }

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
    };
    accessToken?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { name, phone, email, message, company } = req.body;

    // 1. Honeypot validation
    if (company && typeof company === 'string' && company.trim().length > 0) {
        // Silently ignore honeypot submissions
        return res.status(200).json({ success: true, message: 'Message sent successfully' });
    }

     // 2. CSRF protection - validate origin/referer
     const origin = req.headers.origin || req.headers.referer;
     if (!origin || !ALLOWED_ORIGINS.some(allowed => {
         try {
             return new URL(origin).origin === allowed;
         } catch {
             return false;
         }
     })) {
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

        const payload: EmailJSPayload = {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            template_params: {
                name: sanitizedName,
                phone: sanitizedPhone,
                email: sanitizedEmail,
                message: sanitizedMessage,
            },
        };

        if (privateKey) {
            payload.accessToken = privateKey;
        }

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
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
            return res.status(response.status).json({
                message: 'Failed to send message. Please try again later.'
            });
        }
    } catch (error) {
        console.error('[API Route Error]', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
