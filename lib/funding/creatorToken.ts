import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingCreatorTokens } from '../../db/schema';

/**
 * 링크의 수명. 메일함에 남는 값이므로 짧게 잡는다. 너무 짧으면(1~2분) 메일 전달이 늦은
 * 날 로그인 자체가 안 되므로 15분으로 둔다.
 */
export const CREATOR_TOKEN_TTL_SECONDS = 900;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeCreatorEmail = (email: string): string | null => {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
};

const hash = (raw: string): string => createHash('sha256').update(raw).digest('hex');

/**
 * 로그인 토큰 발급. 처음 보는 이메일이면 개설자 행을 만든다 — 가입과 로그인을 나누지 않는다.
 * (아무나 행을 만들 수 있지만 행 하나가 전부이고, 만드는 경로에는 요청 제한이 걸린다.)
 *
 * **발급하면 그 사람의 기존 미사용 토큰을 죽인다.** 링크를 다시 받는 흔한 이유가 "먼저 온
 * 메일이 남의 손에 있을지도 모른다"이기 때문이다.
 */
export const issueCreatorLoginToken = async (
  email: string,
  now: Date = new Date(),
): Promise<{ creatorId: string; rawToken: string } | null> => {
  const normalized = normalizeCreatorEmail(email);
  if (!normalized) return null;

  const db = getDb();
  const [existing] = await db.select().from(fundingCreators)
    .where(eq(fundingCreators.email, normalized)).limit(1);
  const creator = existing
    ?? (await db.insert(fundingCreators).values({ email: normalized, name: normalized.split('@')[0] }).returning())[0];

  // 만료된 토큰은 쌓일 이유가 없다. 발급 경로에 얹어 따로 배치를 두지 않는다.
  await db.delete(fundingCreatorTokens).where(lt(fundingCreatorTokens.expiresAt, now));
  await db.delete(fundingCreatorTokens).where(eq(fundingCreatorTokens.creatorId, creator.id));

  const rawToken = randomBytes(32).toString('base64url');
  await db.insert(fundingCreatorTokens).values({
    tokenHash: hash(rawToken),
    creatorId: creator.id,
    expiresAt: new Date(now.getTime() + CREATOR_TOKEN_TTL_SECONDS * 1000),
  });
  return { creatorId: creator.id, rawToken };
};

/**
 * 토큰을 소진한다. 성공하면 그 뒤로 같은 토큰은 쓸 수 없다.
 *
 * 소진을 UPDATE의 조건으로 넣어(`used_at IS NULL`) 확인과 소진 사이에 다른 요청이 끼어드는
 * 일을 막는다. 읽고 나서 쓰면 같은 링크를 두 번 클릭한 두 요청이 모두 통과할 수 있다.
 */
export const consumeCreatorLoginToken = async (
  rawToken: string,
  now: Date = new Date(),
): Promise<{ creatorId: string } | null> => {
  if (typeof rawToken !== 'string' || rawToken.length < 16) return null;
  const db = getDb();
  const updated = await db.update(fundingCreatorTokens)
    .set({ usedAt: now })
    .where(and(
      eq(fundingCreatorTokens.tokenHash, hash(rawToken)),
      isNull(fundingCreatorTokens.usedAt),
    ))
    .returning();
  const [row] = updated;
  if (!row) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;

  await db.update(fundingCreators).set({ lastLoginAt: now, updatedAt: now })
    .where(eq(fundingCreators.id, row.creatorId));
  return { creatorId: row.creatorId };
};
