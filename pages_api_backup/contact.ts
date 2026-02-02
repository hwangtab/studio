import type { NextApiRequest, NextApiResponse } from 'next';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitStore = new Map<string, { count: number; expiresAt: number }>();

interface ContactRequestBody {
  name: string;
  phone: string;
  message: string;
  company?: string;
}

const getEnvVar = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    if (!key) continue;
    const value = process.env[key];
    if (value) return value;
    const publicValue = process.env[`NEXT_PUBLIC_${key}`];
    if (publicValue) return publicValue;
  }
  return undefined;
};

const getClientIp = (req: NextApiRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
};

const isRateLimited = (ip: string): boolean => {
  if (!ip) return false;
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, expiresAt: now + RATE_LIMIT_WINDOW_MS };

  if (entry.expiresAt < now) {
    entry.count = 0;
    entry.expiresAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);

  return entry.count > RATE_LIMIT_MAX_REQUESTS;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  }

  const { name, phone, message, company } = (req.body || {}) as ContactRequestBody;

  if (typeof company === 'string' && company.trim().length > 0) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  if (!name || !phone || !message) {
    return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
  }

  if (typeof name !== 'string' || typeof phone !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: '잘못된 입력 형식입니다.' });
  }

  const MAX_NAME_LENGTH = 100;
  const MAX_PHONE_LENGTH = 20;
  const MAX_MESSAGE_LENGTH = 5000;

  if (name.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `이름은 ${MAX_NAME_LENGTH}자 이내로 입력해주세요.` });
  }
  if (phone.length > MAX_PHONE_LENGTH) {
    return res.status(400).json({ error: `전화번호는 ${MAX_PHONE_LENGTH}자 이내로 입력해주세요.` });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `메시지는 ${MAX_MESSAGE_LENGTH}자 이내로 입력해주세요.` });
  }

  const phoneRegex = /^[0-9\-\+\s\(\)]{8,20}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: '올바른 전화번호 형식이 아닙니다.' });
  }

  const sanitize = (str: string) => str.replace(/[<>]/g, '').trim();
  const sanitizedName = sanitize(name);
  const sanitizedPhone = sanitize(phone);
  const sanitizedMessage = sanitize(message);

  const serviceId = getEnvVar('EMAILJS_SERVICE_ID');
  const templateId = getEnvVar('EMAILJS_TEMPLATE_ID');
  const publicKey = getEnvVar('EMAILJS_PUBLIC_KEY', 'EMAILJS_USER_ID');

  if (!serviceId || !templateId || !publicKey) {
    return res.status(500).json({ error: '이메일 서비스 환경 변수가 설정되지 않았습니다.' });
  }

  try {
    const customOrigin = getEnvVar('EMAILJS_ALLOWED_ORIGIN') || 'https://studionol.co.kr';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (customOrigin) {
      headers.origin = customOrigin;
    }

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          from_name: sanitizedName,
          from_phone: sanitizedPhone,
          message: sanitizedMessage,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || '이메일 전송에 실패했습니다.');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('EmailJS error:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({ error: '메시지 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
}

export const __contactTestUtils = {
  resetRateLimitStore: () => rateLimitStore.clear(),
};
