const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitStore = new Map();

const getEnvVar = (key) => process.env[key] || process.env[`NEXT_PUBLIC_${key}`];

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
};

const isRateLimited = (ip) => {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  }

  const { name, phone, message, company } = req.body || {};

  if (company) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  if (!name || !phone || !message) {
    return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
  }

  const serviceId = getEnvVar('EMAILJS_SERVICE_ID');
  const templateId = getEnvVar('EMAILJS_TEMPLATE_ID');
  const publicKey = getEnvVar('EMAILJS_PUBLIC_KEY');

  if (!serviceId || !templateId || !publicKey) {
    return res.status(500).json({ error: '이메일 서비스 환경 변수가 설정되지 않았습니다.' });
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          from_name: name,
          from_phone: phone,
          message,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || '이메일 전송에 실패했습니다.');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('EmailJS error:', error);
    return res.status(500).json({ error: '메시지 전송 중 오류가 발생했습니다.' });
  }
}

export const __contactTestUtils = {
  resetRateLimitStore: () => rateLimitStore.clear(),
};
