import { randomBytes } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { showReportLinks } from '../../db/schema';
import { REPORT_LINK_MAX_TTL_DAYS } from './reportLinkLimits';
import { evaluateScanLink, hashScanToken, type ScanLinkRejection } from './scanLink';

/**
 * 기획자 현황 링크 — 공연 기획자·주최 측이 로그인 없이 **한 공연의 판매 집계**만 보는 링크.
 *
 * 스캔 링크(scanLink.ts)와 같은 틀이다: 랜덤 192비트 토큰, DB에는 SHA-256 해시만, 원문은 발급 응답에서 한 번만,
 * 만료·폐기는 검증 때마다 본다. 다른 점은 범위(회차가 아니라 공연 전체)와 기간(판매 기간 내내 보므로 일 단위).
 *
 * 화면(pages/[locale]/shows/report/[token].tsx)은 **집계만** 싣는다 — 처리방침 4항이 "개인정보를 제3자에게
 * 제공하지 않습니다"라고 약속하므로 예매자 이름·연락처·주문번호를 넣으면 그 약속을 깬다. 명단이 필요해지면
 * 처리방침 개정(판본 게이트)이 먼저다.
 */

export { REPORT_LINK_DEFAULT_TTL_DAYS, REPORT_LINK_MAX_TTL_DAYS } from './reportLinkLimits';

export const issueReportLink = async (
  showId: string,
  label: string,
  ttlDays: number,
  now: Date = new Date(),
): Promise<{ token: string; id: string; expiresAt: number }> => {
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) throw new Error('invalid_ttl');
  const ttl = Math.min(ttlDays, REPORT_LINK_MAX_TTL_DAYS);
  const cleanLabel = label.trim().slice(0, 40);
  if (!cleanLabel) throw new Error('label_required');

  // 소문자 hex — 경로에 실리고 middleware.ts가 대문자 경로를 소문자로 308한다(scanLink.ts와 같은 이유).
  const token = randomBytes(24).toString('hex');
  const expiresAt = Math.floor(now.getTime() / 1000) + Math.floor(ttl * 86400);
  const [row] = await getDb()
    .insert(showReportLinks)
    .values({ showId, tokenHash: hashScanToken(token), label: cleanLabel, expiresAt })
    .returning({ id: showReportLinks.id });
  return { token, id: row.id, expiresAt };
};

export type VerifyReportLinkResult =
  | { ok: true; link: { id: string; showId: string; label: string; expiresAt: number } }
  | { ok: false; reason: ScanLinkRejection };

export const verifyReportLink = async (token: unknown, now: Date = new Date()): Promise<VerifyReportLinkResult> => {
  if (typeof token !== 'string' || token.length < 16 || token.length > 128) {
    return { ok: false, reason: 'invalid' };
  }
  const row = await getDb().query.showReportLinks.findFirst({
    where: (l, { eq: e }) => e(l.tokenHash, hashScanToken(token)),
  });
  const rejection = evaluateScanLink(row, Math.floor(now.getTime() / 1000));
  if (rejection || !row) return { ok: false, reason: rejection ?? 'invalid' };
  return { ok: true, link: { id: row.id, showId: row.showId, label: row.label, expiresAt: row.expiresAt } };
};

/** 폐기 — 그 공연의 링크일 때만. 이미 폐기된 링크의 시각은 덮어쓰지 않는다. 처음 폐기됐으면 true. */
export const revokeReportLink = async (showId: string, id: string, now: Date = new Date()): Promise<boolean> => {
  const result = await getDb()
    .update(showReportLinks)
    .set({ revokedAt: Math.floor(now.getTime() / 1000) })
    .where(and(eq(showReportLinks.id, id), eq(showReportLinks.showId, showId), sql`${showReportLinks.revokedAt} IS NULL`));
  return (result as { rowsAffected?: number }).rowsAffected === 1;
};

export interface ReportLinkSummary {
  id: string;
  label: string;
  expiresAt: number;
  revokedAt: number | null;
  createdAt: number;
}

/**
 * 관리자 화면용 목록. 표(0051)가 아직 없으면 null — 마이그레이션 전에 배포돼도 관리자 공연 화면 전체가
 * 깨지지 않게 한다(발급 영역만 "적용 전"으로 보인다).
 */
export const listReportLinks = async (showId: string): Promise<ReportLinkSummary[] | null> => {
  try {
    const rows = await getDb().query.showReportLinks.findMany({
      where: (l, { eq: e }) => e(l.showId, showId),
      orderBy: (l, { desc }) => desc(l.createdAt),
    });
    return rows.map((l) => ({ id: l.id, label: l.label, expiresAt: l.expiresAt, revokedAt: l.revokedAt, createdAt: l.createdAt }));
  } catch (error) {
    console.error('[shows/report-link] 링크 목록을 읽지 못했습니다(마이그레이션 0051 확인)', error);
    return null;
  }
};
