import { createHash } from 'crypto';
import type { NextApiRequest } from 'next';
import validator from 'validator';

import { getRedisRestConfig, incrWithExpire } from '../rate-limit/redisRest';

const LIMIT = 5;
const WINDOW = 15 * 60;
const UNKNOWN_IP_LIMIT = 3;
const UNKNOWN_IP_WINDOW = 2 * 60;
const UNKNOWN_IP_KEY = 'unknown';

export const CONTACT_RATE_LIMIT_ERROR = {
  exceeded: 'CONTACT_RATE_LIMIT_EXCEEDED',
  unavailable: 'CONTACT_RATE_LIMIT_UNAVAILABLE',
} as const;

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

/**
 * 요청을 보낸 쪽의 IP.
 *
 * `x-real-ip`·`x-forwarded-for`는 쓰지 않는다. 두 헤더는 누구나 요청에 직접 넣을 수
 * 있어서, 값을 그대로 믿으면 헤더만 바꿔 가며 제한을 무한히 피할 수 있다.
 * Vercel 프록시가 `x-vercel-forwarded-for`를 항상 덮어쓰므로 프로덕션에서 이 폴백들이
 * 쓰일 일도 사실상 없었지만, 계약 쪽(lib/contracts/client-ip.ts)은 같은 이유로 이미
 * `x-vercel-forwarded-for`만 신뢰하고 있었다. 두 모듈의 판정 기준을 맞춘다.
 *
 * IP를 못 얻으면 아래의 요청 지문으로 폴백한다 — 없는 것보다 낫고, 위조 헤더를
 * 믿는 것보다는 훨씬 낫다.
 */
const getClientIP = (req: NextApiRequest): string => {
  const vercelIP = getFirstValidIP(req.headers['x-vercel-forwarded-for']);
  if (vercelIP) return vercelIP;

  const socketIP = normalizeIP(req.socket.remoteAddress || '');
  return socketIP || UNKNOWN_IP_KEY;
};

const buildFallbackFingerprint = (req: NextApiRequest): string => {
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
};

const getRateLimitSubject = (req: NextApiRequest): RateLimitSubject => {
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
    throw new Error(CONTACT_RATE_LIMIT_ERROR.exceeded);
  }

  memoryRateLimitStore.set(key, { count: nextCount, expiresAt: existing.expiresAt });
};

export const checkContactRateLimit = async (req: NextApiRequest): Promise<void> => {
  const subject = getRateLimitSubject(req);
  const redisConfig = getRedisRestConfig();

  if (redisConfig) {
    try {
      const key = `rate_limit_contact:${subject.key}`;
      const count = await incrWithExpire({ key, windowSeconds: subject.windowSeconds, config: redisConfig });

      if (count > subject.limit) {
        throw new Error(CONTACT_RATE_LIMIT_ERROR.exceeded);
      }
      return;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === CONTACT_RATE_LIMIT_ERROR.exceeded) throw error;

      console.error('[Rate Limit] Redis REST failed:', error);
      throw new Error(CONTACT_RATE_LIMIT_ERROR.unavailable);
    }
  }

  if (!hasLoggedMemoryFallback) {
    const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    console.warn(`[Rate Limit] Redis REST not configured (${env}). Using in-memory limiter fallback. Set KV_REST_API_URL and KV_REST_API_TOKEN.`);
    hasLoggedMemoryFallback = true;
  }

  checkRateLimitInMemory(subject);
};
