import { createHash } from 'crypto';
import type { NextApiRequest } from 'next';

import { getRedisRestConfig, incrWithExpire } from '../rate-limit/redisRest';

/** 관리자 비밀번호는 하나뿐이라 무차별 대입에 특히 취약하다. 창을 좁게 잡는다. */
const LIMIT = 10;
const WINDOW_SECONDS = 10 * 60;

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
let hasLoggedMemoryFallback = false;

const getSubjectKey = (req: NextApiRequest): string => {
  const forwarded = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = String(raw || req.socket.remoteAddress || '').split(',')[0].trim();

  if (ip) return `ip:${ip}`;

  // IP를 못 얻으면 요청 지문으로 대체한다 — 없는 것보다는 낫다.
  const fingerprint = createHash('sha256')
    .update(String(req.headers['user-agent'] || ''))
    .update(String(req.headers['accept-language'] || ''))
    .digest('hex')
    .slice(0, 24);
  return `fp:${fingerprint}`;
};

const checkInMemory = (key: string): boolean => {
  const now = Date.now();

  for (const [storedKey, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) memoryStore.delete(storedKey);
  }

  const existing = memoryStore.get(key);
  if (!existing || existing.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 });
    return true;
  }

  existing.count += 1;
  return existing.count <= LIMIT;
};

/**
 * 관리자 로그인 시도 제한. 허용이면 true.
 *
 * Redis가 없으면 인스턴스 로컬 메모리로 폴백한다. 서버리스에서는 인스턴스마다 카운터가
 * 갈리므로 완벽하지 않지만, 로그인 실패는 세션 없이 반복되므로 같은 인스턴스로 몰리는
 * 경우가 많아 실효가 있다. 정확한 제한이 필요하면 KV_REST_API_URL을 설정한다.
 */
export const checkAdminLoginRateLimit = async (req: NextApiRequest): Promise<boolean> => {
  const key = `rate_limit_admin_login:${getSubjectKey(req)}`;
  const config = getRedisRestConfig();

  if (config) {
    try {
      const count = await incrWithExpire({ key, windowSeconds: WINDOW_SECONDS, config });
      return count <= LIMIT;
    } catch (error: unknown) {
      console.error('[admin-rate-limit] Redis REST failed, falling back to memory:', error);
    }
  } else if (!hasLoggedMemoryFallback) {
    console.warn('[admin-rate-limit] Redis REST not configured. Using in-memory limiter.');
    hasLoggedMemoryFallback = true;
  }

  return checkInMemory(key);
};
