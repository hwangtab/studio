import { createHash, randomBytes } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { showScanLinks } from '../../db/schema';

/**
 * 입장 스캔 링크 — 현장 스태프가 로그인 없이 한 회차의 체크인만 할 수 있는 링크.
 *
 * 토큰은 랜덤 192비트이고 DB에는 SHA-256 해시만 둔다(유출돼도 링크를 되살릴 수 없다).
 * 원문 토큰은 발급 응답에서 **한 번만** 돌려준다. 만료·폐기는 검증 때마다 본다.
 */

export const SCAN_LINK_MAX_TTL_HOURS = 72;

export const hashScanToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export type ScanLinkRejection = 'invalid' | 'expired' | 'revoked';

/** 행과 시각만으로 유효 여부를 판정하는 순수 함수 — 테스트가 DB 없이 쓴다. */
export const evaluateScanLink = (
  row: { expiresAt: number; revokedAt: number | null } | null | undefined,
  nowSec: number,
): ScanLinkRejection | null => {
  if (!row) return 'invalid';
  if (row.revokedAt !== null && row.revokedAt !== undefined) return 'revoked';
  if (row.expiresAt <= nowSec) return 'expired';
  return null;
};

export const issueScanLink = async (
  showtimeId: string,
  label: string,
  ttlHours: number,
  now: Date = new Date(),
): Promise<{ token: string; id: string; expiresAt: number }> => {
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) throw new Error('invalid_ttl');
  const ttl = Math.min(ttlHours, SCAN_LINK_MAX_TTL_HOURS);
  const cleanLabel = label.trim().slice(0, 40);
  if (!cleanLabel) throw new Error('label_required');

  const token = randomBytes(24).toString('base64url');
  const expiresAt = Math.floor(now.getTime() / 1000) + Math.floor(ttl * 3600);
  const [row] = await getDb()
    .insert(showScanLinks)
    .values({ showtimeId, tokenHash: hashScanToken(token), label: cleanLabel, expiresAt })
    .returning({ id: showScanLinks.id });
  return { token, id: row.id, expiresAt };
};

export type VerifyScanLinkResult =
  | { ok: true; link: { id: string; showtimeId: string; label: string; expiresAt: number } }
  | { ok: false; reason: ScanLinkRejection };

export const verifyScanLink = async (
  token: string,
  now: Date = new Date(),
): Promise<VerifyScanLinkResult> => {
  if (typeof token !== 'string' || token.length < 16 || token.length > 128) {
    return { ok: false, reason: 'invalid' };
  }
  const row = await getDb().query.showScanLinks.findFirst({
    where: (l, { eq: e }) => e(l.tokenHash, hashScanToken(token)),
  });
  const rejection = evaluateScanLink(row, Math.floor(now.getTime() / 1000));
  if (rejection || !row) return { ok: false, reason: rejection ?? 'invalid' };
  return {
    ok: true,
    link: { id: row.id, showtimeId: row.showtimeId, label: row.label, expiresAt: row.expiresAt },
  };
};

/** 폐기 — 이미 폐기된 링크의 시각을 덮어쓰지 않는다. 처음 폐기됐으면 true. */
export const revokeScanLink = async (id: string, now: Date = new Date()): Promise<boolean> => {
  const result = await getDb()
    .update(showScanLinks)
    .set({ revokedAt: Math.floor(now.getTime() / 1000) })
    .where(and(eq(showScanLinks.id, id), sql`${showScanLinks.revokedAt} IS NULL`));
  return (result as { rowsAffected?: number }).rowsAffected === 1;
};
