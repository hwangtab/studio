import type { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, number[]>();
const LIMIT = 5; // max 5 requests
const WINDOW = 15 * 60 * 1000; // 15 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { name, phone, email, message, company } = req.body;

    // 1. Honeypot validation
    if (company && company.trim().length > 0) {
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

    // 3. Validation
    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // 4. Send email via EmailJS REST API
    try {
        const serviceId = process.env.EMAILJS_SERVICE_ID;
        const templateId = process.env.EMAILJS_TEMPLATE_ID;
        const publicKey = process.env.EMAILJS_PUBLIC_KEY;
        const privateKey = process.env.EMAILJS_PRIVATE_KEY; // Optional but recommended for server-side

        if (!serviceId || !templateId || !publicKey) {
            console.error('Missing EmailJS configuration');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const payload: any = {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            template_params: {
                name,
                phone,
                email,
                message,
            },
        };

        // If private key is available, include it for extra security
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
            console.error('EmailJS error:', errorText);
            return res.status(response.status).json({ message: 'Failed to send message' });
        }
    } catch (error) {
        console.error('API Route error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
