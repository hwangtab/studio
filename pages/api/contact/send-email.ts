import type { NextApiRequest, NextApiResponse } from 'next';
import validator from 'validator';

import { kv } from '@vercel/kv';

// Rate limiting configuration
const LIMIT = 5; // max 5 requests
const WINDOW = 15 * 60; // 15 minutes in seconds (KV uses seconds for TTL)

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

    // 2. Rate limiting by IP
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    try {
        await checkRateLimit(ip);
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED') {
            return res.status(429).json({ message: 'Too many requests. Please try again later.' });
        }
        console.error('[API Route Error] Rate limit check failed:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }

    // 3. Validation & Sanitization
    if (!name || typeof name !== 'string' || validator.isEmpty(name)) {
        return res.status(400).json({ message: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!message || typeof message !== 'string' || validator.isEmpty(message)) {
        return res.status(400).json({ message: 'Message is required' });
    }

    // Length limits
    if (name.length > 100 || (phone && phone.length > 50) || message.length > 5000) {
        return res.status(400).json({ message: 'Input too long' });
    }

    // Sanitization
    const sanitizedName = validator.escape(name.trim());
    const sanitizedEmail = validator.normalizeEmail(email.trim()) || email.trim();
    const sanitizedMessage = validator.escape(message.trim());
    const sanitizedPhone = phone ? validator.escape(String(phone).trim()) : undefined;

    // 4. Send email via EmailJS REST API
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
