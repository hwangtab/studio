import type { NextApiRequest, NextApiResponse } from 'next';
import validator from 'validator';

// Simple in-memory rate limiting
// NOTE: This will not be shared across serverless instances.
// Consider using Vercel KV or Upstash for production.
const rateLimitMap = new Map<string, number[]>();
const LIMIT = 5; // max 5 requests
const WINDOW = 15 * 60 * 1000; // 15 minutes

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
    const now = Date.now();
    const timestamps = rateLimitMap.get(ip) || [];
    const recentTimestamps = timestamps.filter(t => now - t < WINDOW);

    if (recentTimestamps.length >= LIMIT) {
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    recentTimestamps.push(now);
    rateLimitMap.set(ip, recentTimestamps);

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

