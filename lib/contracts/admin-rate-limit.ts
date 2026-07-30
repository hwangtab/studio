import { createHash } from 'crypto';
import { eq, lte, sql } from 'drizzle-orm';
import type { NextApiRequest } from 'next';

import { getDb } from '../../db/client';
import { rateLimits } from '../../db/schema';

/** 관리자 비밀번호는 하나뿐이라 무차별 대입에 특히 취약하다. 창을 좁게 잡는다. */
const LIMIT = 10;
const WINDOW_SECONDS = 10 * 60;

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

const getSubjectKey = (req: NextApiRequest): string => {
  const forwarded = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = String(raw || req.socket.remoteAddress || '').split(',')[0].trim();

  if (ip) return `admin_login:ip:${ip}`;

  // IP를 못 얻으면 요청 지문으로 대체한다 — 없는 것보다는 낫다.
  const fingerprint = createHash('sha256')
    .update(String(req.headers['user-agent'] || ''))
    .update(String(req.headers['accept-language'] || ''))
    .digest('hex')
    .slice(0, 24);
  return `admin_login:fp:${fingerprint}`;
};

/** DB에 닿지 못할 때만 쓰는 인스턴스 로컬 폴백. */
const checkInMemory = (key: string, nowSeconds: number): boolean => {
  for (const [storedKey, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= nowSeconds) memoryStore.delete(storedKey);
  }

  const existing = memoryStore.get(key);
  if (!existing || existing.expiresAt <= nowSeconds) {
    memoryStore.set(key, { count: 1, expiresAt: nowSeconds + WINDOW_SECONDS });
    return true;
  }

  existing.count += 1;
  return existing.count <= LIMIT;
};

/**
 * 관리자 로그인 시도 제한. 허용이면 true.
 *
 * 카운터를 Turso에 두어 서버리스 인스턴스 사이에서 공유한다. 프로세스 메모리에 두면
 * 인스턴스마다 카운터가 갈려 제한이 사실상 무력해진다.
 *
 * DB에 닿지 못하면 인스턴스 로컬 메모리로 폴백한다. 제한이 느슨해지긴 하지만,
 * 카운터를 셀 수 없다는 이유로 정당한 로그인까지 막지는 않는다(비밀번호라는 방어선이
 * 여전히 남아 있다).
 */
export const checkAdminLoginRateLimit = async (req: NextApiRequest): Promise<boolean> => {
  const key = getSubjectKey(req);
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    // 만료된 창을 먼저 지운다. 이후의 삽입은 항상 새 창을 여는 셈이 되고,
    // 행이 무한정 쌓이지도 않는다(로그인 시도 자체가 드물어 비용은 무시할 수준).
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));

    const [row] = await getDb()
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt: nowSeconds + WINDOW_SECONDS })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning();

    return (row?.count ?? 1) <= LIMIT;
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Falling back to in-memory counter:', error);
    return checkInMemory(key, nowSeconds);
  }
};

/**
 * 서명 본인 확인 시도 제한.
 *
 * 뒷자리는 네 자리뿐이라 제한이 없으면 링크를 아는 사람이 전부 대입해 볼 수 있다. 다만
 * 오타로 정당한 고객이 막히면 계약이 멈추므로, 창을 짧게 두고 횟수는 넉넉히 잡는다.
 */
const IDENTITY_LIMIT = 10;
const IDENTITY_WINDOW_SECONDS = 15 * 60;

export const checkIdentityAttemptLimit = async (contractId: string): Promise<boolean> => {
  const key = `sign_identity:${contractId}`;
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));

    const [row] = await getDb()
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt: nowSeconds + IDENTITY_WINDOW_SECONDS })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
      .returning();

    return (row?.count ?? 1) <= IDENTITY_LIMIT;
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Identity attempt limit unavailable:', error);
    // 셀 수 없다는 이유로 정당한 서명을 막지는 않는다. 뒷자리 대조 자체는 그대로 남는다.
    return true;
  }
};

/**
 * 계약서 재발급 제한.
 *
 * 보관본이 없으면 Chromium을 띄워 다시 만들어야 해서, 토큰을 아는 쪽이 반복 요청하면
 * 부담이 된다. 정상적인 이용자가 몇 번 다시 받는 것은 막지 않을 만큼만 허용한다.
 */
const DOWNLOAD_LIMIT = 10;
const DOWNLOAD_WINDOW_SECONDS = 10 * 60;

export const checkDownloadRateLimit = async (contractId: string): Promise<boolean> => {
  const key = `contract_download:${contractId}`;
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));

    const [row] = await getDb()
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt: nowSeconds + DOWNLOAD_WINDOW_SECONDS })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
      .returning();

    return (row?.count ?? 1) <= DOWNLOAD_LIMIT;
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Download limit unavailable:', error);
    // 셀 수 없다는 이유로 계약 당사자가 자기 계약서를 못 받게 하지는 않는다.
    return true;
  }
};

/** 본인 확인에 성공하면 시도 기록을 지운다. */
export const resetIdentityAttempts = async (contractId: string): Promise<void> => {
  try {
    await getDb().delete(rateLimits).where(eq(rateLimits.key, `sign_identity:${contractId}`));
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Failed to reset identity attempts:', error);
  }
};

/**
 * 로그인에 성공하면 카운터를 지운다.
 *
 * 지우지 않으면 실패가 쌓인 창 안에서는 정상 로그인도 한도를 채워 나가, 비밀번호를
 * 아는 관리자가 자기 시스템에서 잠긴다. 공유 IP(NAT)에서는 남이 흘린 실패까지 얹히므로
 * 더 쉽게 발생한다. 성공은 "이 주체는 공격자가 아니다"라는 증거이므로 창을 닫아 준다.
 */
export const resetAdminLoginRateLimit = async (req: NextApiRequest): Promise<void> => {
  const key = getSubjectKey(req);
  memoryStore.delete(key);

  try {
    await getDb().delete(rateLimits).where(eq(rateLimits.key, key));
  } catch (error: unknown) {
    console.error('[admin-rate-limit] Failed to reset counter after login:', error);
  }
};
