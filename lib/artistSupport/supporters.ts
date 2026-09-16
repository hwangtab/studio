import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { subscriptions, type Subscription } from '../../db/schema';

/**
 * 아티스트 페이지에 실리는 "후원 중" 상태. 결제한 달이 끝날 때까지는 해지 예정(cancelled)도
 * 후원자다(스펙 §9 — 이미 결제한 달의 혜택은 월말까지). ended·pending_card·paused는 뺀다:
 * ended는 끝났고, pending_card는 아직 낸 적이 없으며, paused는 재시도까지 다 실패해 이번 달
 * 돈이 안 들어온 상태다.
 */
export const SUPPORTING_STATUSES: Subscription['status'][] = ['active', 'past_due', 'cancelled'];

export interface PublicSupporter {
  displayName: string;
  since: string;
}

/** 명단 공개에 동의한 후원자만, 최신 가입순. 금액·등급은 싣지 않는다(스펙 §11.3). */
export const listPublicSupporters = async (artistSlug: string, limit = 100): Promise<PublicSupporter[]> => {
  const rows = await getDb()
    .select({ displayName: subscriptions.displayName, customerName: subscriptions.customerName, createdAt: subscriptions.createdAt })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.kind, 'artist-support'),
        eq(subscriptions.artistSlug, artistSlug),
        eq(subscriptions.displayConsent, true),
        inArray(subscriptions.status, SUPPORTING_STATUSES),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit);
  return rows.map((r) => ({ displayName: r.displayName || r.customerName, since: r.createdAt.toISOString().slice(0, 10) }));
};

/** 동의 여부와 무관한 후원자 수 — "n명이 후원 중" 표시용. */
export const countSupporters = async (artistSlug: string): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.kind, 'artist-support'),
        eq(subscriptions.artistSlug, artistSlug),
        inArray(subscriptions.status, SUPPORTING_STATUSES),
      ),
    );
  return Number(row?.count ?? 0);
};

/** 아티스트별 후원자 수 한 번에 — 관리자 아티스트 목록. */
export const countSupportersByArtist = async (): Promise<Map<string, number>> => {
  const rows = await getDb()
    .select({ artistSlug: subscriptions.artistSlug, count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(and(eq(subscriptions.kind, 'artist-support'), inArray(subscriptions.status, SUPPORTING_STATUSES)))
    .groupBy(subscriptions.artistSlug);
  return new Map(rows.filter((r) => r.artistSlug).map((r) => [r.artistSlug as string, Number(r.count)]));
};

/**
 * 소식 메일 발송용 — 관리자가 CSV로 내려받아 운영자가 직접 보낸다(스펙 §12: 아티스트 소식
 * 메일 자동 발송은 범위 밖). 개인정보라 관리자 인증 뒤에서만 부른다.
 */
export const listSupporterContacts = async (artistSlug: string): Promise<Array<Pick<Subscription, 'customerName' | 'customerEmail' | 'displayName' | 'displayConsent' | 'tierId' | 'status' | 'createdAt'>>> =>
  getDb()
    .select({
      customerName: subscriptions.customerName,
      customerEmail: subscriptions.customerEmail,
      displayName: subscriptions.displayName,
      displayConsent: subscriptions.displayConsent,
      tierId: subscriptions.tierId,
      status: subscriptions.status,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.kind, 'artist-support'),
        eq(subscriptions.artistSlug, artistSlug),
        inArray(subscriptions.status, SUPPORTING_STATUSES),
      ),
    )
    .orderBy(desc(subscriptions.createdAt));
