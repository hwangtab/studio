import { waitUntil } from '@vercel/functions';
import { and, asc, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, contracts, fundingProjects, orders, socialTokens, subscriptions, workOrders } from '../../db/schema';
import { getProduct } from '../booking/products';
import { checkFieldCryptoKey, checkTossApiKeyPair, collectDbIssues, type HealthIssue } from './healthCheck';
import { countPendingArtistPayouts } from '../artistSupport/payout';
import { countPendingFundingPayouts, listFundingProjectsAwaitingPayoutRecord } from '../funding/payout';
import { listShopPayoutsAwaitingRecord } from '../partnerPayouts/shop';
import { listShowPayoutsAwaitingRecord } from '../partnerPayouts/show';
import { countPendingPartnerPayouts } from '../partnerPayouts/store';

/**
 * 관리자 첫 화면의 데이터.
 *
 * 예전 첫 화면은 링크 네 개였다. 처리할 일은 각 목록을 열어야 배너로 보였고, 조용한 실패는
 * 하루 한 번 크론 메일로만 왔다. 여기서는 그 크론이 쓰는 판정식(collectDbIssues)을 그대로
 * 불러 "지금 손봐야 할 것"을 맨 위에 놓고, 그 아래에 "곧 닥칠 일"(이번 주 세션·착수 대기
 * 믹싱·카드 등록 대기·서명 대기)을 건수로 둔다. 판정을 두 벌로 두지 않는 것이 핵심이다 —
 * 메일과 화면이 다른 건수를 말하면 둘 다 못 믿게 된다.
 *
 * 외부 호출(캘린더·GA4·소셜 API)은 하지 않는다. 화면을 열 때마다 구글을 찌르면 느리고,
 * 그쪽 장애가 관리자 화면까지 막는다.
 */

import { syncLinkEventsFromCalendar } from '../payments/linkCalendar';
import { loadUnlinkedCalendarEvents, type UnlinkedCalendarEvent } from './calendarImport';

export interface UpcomingSession {
  /** `booking` = 예약 시스템의 확정 세션, `link` = 결제 링크로 결제된 이용(링크에 적은 이용 일시 — 2026-10-15). */
  kind: 'booking' | 'link';
  orderId: string;
  orderNo: string;
  customerName: string;
  productName: string;
  startAt: string;
  endAt: string;
}

export interface SocialTokenStatus {
  platform: string;
  expiresAt: string;
  daysLeft: number;
}

export interface AwaitingDepositCounts {
  /** 예약·믹싱·예약금 결제 링크. */
  bookings: number;
  /** 공연 티켓. */
  shows: number;
  /** 상점 주문. */
  shop: number;
  /** 펀딩 후원(계좌 입금 신청, 입금 확인 전). */
  funding: number;
}

export interface AdminDashboard {
  issues: HealthIssue[];
  /** 오늘(KST 0시)부터 7일 안의 확정 세션, 시작 시각순. */
  upcomingSessions: UpcomingSession[];
  /** 같은 창에서 **캘린더에만 있는** 일정(사이트 미등록) — "사이트에 등록"으로 가져온다(lib/ops/calendarImport.ts). */
  calendarEvents: UnlinkedCalendarEvent[];
  /** 캘린더를 못 읽었으면 문구(그 갈래만 비어 있다). */
  calendarError: string | null;
  queues: {
    mixingReceived: number;
    mixingInProgress: number;
    subscriptionsPendingCard: number;
    subscriptionsPastDue: number;
    subscriptionsPaused: number;
    contractsAwaitingSignature: number;
    /** 기록됐지만 아직 이체하지 않은 아티스트 정산. */
    artistPayoutsPending: number;
    /** 개설자가 제출해 운영자 승인을 기다리는 펀딩 프로젝트. */
    fundingProjectsAwaitingReview: number;
    /** 기록됐지만 아직 개설자에게 이체하지 않은 펀딩 정산. */
    fundingPayoutsPending: number;
    /** 모금이 끝났는데 정산이 아직 기록되지 않은 프로젝트(살아 있는 후원이 있는 것만). */
    fundingPayoutsToRecord: number;
    /** 이번 달 이전 달 가운데 판매가 있었는데 정산이 기록되지 않은 상점 아티스트×달 쌍. 표(0067)가 없거나 조회가 실패하면 0. */
    shopPayoutsToRecord: number;
    /** 기록됐지만 아직 이체하지 않은 상점 정산. 표(0067)가 없거나 조회가 실패하면 0. */
    shopPayoutsPending: number;
    /** 마지막 회차가 끝났는데 정산이 기록되지 않은 주최자 공연(직영 제외). 표(0067·0055)가 없거나 조회가 실패하면 0. */
    showPayoutsToRecord: number;
    /** 기록됐지만 아직 이체하지 않은 공연 정산. 표(0067)가 없거나 조회가 실패하면 0. */
    showPayoutsPending: number;
    /** 계좌 입금을 기다리는 주문(자동 취소 없음 — 운영자가 입금을 확인하거나 닫아야 한다). */
    awaitingDeposit: AwaitingDepositCounts;
  };
  socialTokens: SocialTokenStatus[];
  /** upcomingSessions의 창 길이(일). 화면 문구용 — 페이지가 이 모듈을 값으로 import하지 않게 데이터에 싣는다. */
  upcomingWindowDays: number;
  checkedAt: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export // 캘린더에만 있는 일정은 이번 주 세션보다 멀리 본다 — 한 주 밖의 러프한 일정도 웹 예약 시간을 이미 막고 있다.
const CALENDAR_IMPORT_DAYS = 60;
const UPCOMING_WINDOW_DAYS = 7;
const LINK_SYNC_WAIT_MS = 3000;

/** KST 달력의 오늘 0시(UTC Date). 이미 시작한 오늘 세션도 목록에 남긴다. */
const startOfTodayKst = (now: Date): Date => {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
};

export const loadAdminDashboard = async (now: Date = new Date()): Promise<AdminDashboard> => {
  const db = getDb();

  const from = startOfTodayKst(now);
  const to = new Date(from.getTime() + UPCOMING_WINDOW_DAYS * DAY_MS);

  // 캘린더 → 사이트: 운영자가 캘린더에서 옮기거나 지운 링크 일정을 먼저 주문에 반영한다(아래 "이번 주 세션" 조회가 그 값을 읽는다). 던지지 않는다.
  // 구글 응답이 느려도 첫 화면이 같이 느려지지 않게 3초까지만 기다린다(못 끝낸 동기화는 뒤에서 계속 돌고, 다음 열람에 반영된다).
  const linkSync = syncLinkEventsFromCalendar(now).catch(() => undefined);
  // 응답을 보낸 뒤에도 끝까지 돌게 등록한다 — 서버리스는 응답 후 대기 중 작업을 멈출 수 있다.
  try {
    waitUntil(linkSync);
  } catch {
    // 요청 컨텍스트 밖(테스트·스크립트)에서는 등록하지 않는다 — 아래 대기만으로 충분하다.
  }
  await Promise.race([linkSync, new Promise<void>((resolve) => {
    setTimeout(resolve, LINK_SYNC_WAIT_MS).unref?.();
  })]);

  const [issues, sessions, calendarImport, linkSessions, mixingCounts, subscriptionCounts, contractRows, tokens, artistPayoutsPending, fundingReviewRows, fundingPayoutsPending, fundingPayoutsToRecord, shopPayoutsToRecord, shopPayoutsPending, showPayoutsToRecord, showPayoutsPending, awaitingDepositRows] = await Promise.all([
    collectDbIssues(now),
    db
      .select({
        orderId: orders.id,
        orderNo: orders.orderNo,
        customerName: orders.customerName,
        productId: bookings.productId,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
      })
      .from(bookings)
      .innerJoin(orders, eq(orders.id, bookings.orderId))
      .where(and(eq(bookings.status, 'confirmed'), gte(bookings.startAt, from), lt(bookings.startAt, to)))
      .orderBy(asc(bookings.startAt)),
    loadUnlinkedCalendarEvents(from, new Date(from.getTime() + CALENDAR_IMPORT_DAYS * DAY_MS)),
    // 결제 링크로 결제된 이용(예약 시스템에 행이 없다) — 링크에 적은 이용 일시가 이 창 안인 것. 표가 없는 DB(0062 전)에서도 대시보드는 열린다.
    db.all<{ order_id: string; order_no: string; customer_name: string; item_name: string; session_at: number; session_hours: number | null }>(sql`
      SELECT o.id AS order_id, o.order_no, o.customer_name, plo.item_name, plo.session_at, plo.session_hours
      FROM payment_link_orders plo JOIN orders o ON o.order_no = plo.order_no
      WHERE o.type = 'deposit' AND o.status IN ('paid', 'partially_refunded')
        AND plo.session_at IS NOT NULL AND plo.session_at >= ${Math.floor(from.getTime() / 1000)} AND plo.session_at < ${Math.floor(to.getTime() / 1000)}
      ORDER BY plo.session_at
    `).catch((error: unknown) => {
      console.error('[admin-dashboard] 결제 링크 이용 일정 조회 실패 — 건너뜁니다', error instanceof Error ? error.name : 'unknown');
      return [];
    }),
    db
      .select({ status: workOrders.status, count: sql<number>`count(*)` })
      .from(workOrders)
      .where(inArray(workOrders.status, ['received', 'in_progress']))
      .groupBy(workOrders.status),
    db
      .select({ status: subscriptions.status, count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(inArray(subscriptions.status, ['pending_card', 'past_due', 'paused']))
      .groupBy(subscriptions.status),
    db
      .select({ count: sql<number>`count(*)` })
      .from(contracts)
      .where(and(eq(contracts.status, 'sent'), gt(contracts.expiresAt, now))),
    db.select({ platform: socialTokens.platform, expiresAt: socialTokens.expiresAt }).from(socialTokens),
    countPendingArtistPayouts(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(fundingProjects)
      .where(eq(fundingProjects.reviewStatus, 'submitted')),
    countPendingFundingPayouts(),
    // 마감 뒤 정산 기록 대기 — 표 조회가 실패해도 대시보드는 열려야 한다(null이면 카드를 숨긴다).
    listFundingProjectsAwaitingPayoutRecord(now).then((rows) => rows.length).catch((error: unknown) => {
      console.error('[admin-dashboard] 정산 기록 대기 조회 실패 — 건너뜁니다', error instanceof Error ? error.name : 'unknown');
      return 0;
    }),
    // 상점 정산 — 표(0067)가 없거나 조회가 실패해도 대시보드는 열려야 한다(0이면 카드가 안 뜬다). 상점은 기한 알림이 없다(위탁 약관은 "알린다"만 정한다).
    listShopPayoutsAwaitingRecord(now).then((rows) => rows.length).catch((error: unknown) => {
      console.error('[admin-dashboard] 상점 정산 기록 대기 조회 실패 — 건너뜁니다', error instanceof Error ? error.name : 'unknown');
      return 0;
    }),
    countPendingPartnerPayouts('shop').catch((error: unknown) => {
      console.error('[admin-dashboard] 상점 이체 대기 조회 실패 — 건너뜁니다', error instanceof Error ? error.name : 'unknown');
      return 0;
    }),
    // 공연 정산 — 상점과 같이 표가 없거나 조회가 실패해도 대시보드는 열려야 한다. 기한(약관 제6조)을 넘긴 건은 점검 메일(healthCheck)이 따로 알린다.
    listShowPayoutsAwaitingRecord(now).then((rows) => rows.length).catch((error: unknown) => {
      console.error('[admin-dashboard] 공연 정산 기록 대기 조회 실패 — 건너뜁니다', error instanceof Error ? error.name : 'unknown');
      return 0;
    }),
    countPendingPartnerPayouts('show').catch((error: unknown) => {
      console.error('[admin-dashboard] 공연 이체 대기 조회 실패 — 건너뜁니다', error instanceof Error ? error.name : 'unknown');
      return 0;
    }),
    db.all<{ kind: string; n: number }>(sql`
      SELECT CASE WHEN o.type = 'ticket' THEN 'shows' WHEN o.type = 'merch' THEN 'shop'
                  WHEN o.type = 'funding' THEN 'funding' ELSE 'bookings' END AS kind, COUNT(*) AS n
      FROM orders o
      WHERE o.status = 'awaiting_deposit' OR (o.type = 'funding' AND o.status = 'pending'
        AND EXISTS (SELECT 1 FROM funding_pledges fp WHERE fp.order_id = o.id AND fp.payment_method = 'bank_transfer' AND fp.entry_source = 'online'))
      GROUP BY kind
    `),
  ]);

  const countOf = (rows: Array<{ status: string; count: number }>, status: string): number =>
    Number(rows.find((row) => row.status === status)?.count ?? 0);

  // 매일 점검 메일에는 있고 화면에는 없던 환경 점검 — 외부 호출이 없는 로컬 검사라 화면에서도 쓴다(토스 키 쌍·필드 암호화 키).
  // 키가 빠지면 결제·정산 저장이 통째로 안 되는데, 메일을 놓치면 이 화면에서도 아무것도 안 보였다.
  const envIssues = [checkTossApiKeyPair(), checkFieldCryptoKey()].filter((issue): issue is HealthIssue => issue !== null);

  return {
    issues: [...envIssues, ...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1)),
    upcomingSessions: [
      ...sessions.map((row) => ({
      kind: 'booking' as const,
      orderId: row.orderId,
      orderNo: row.orderNo,
      customerName: row.customerName,
      productName: getProduct(row.productId)?.nameKo ?? row.productId,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
    })),
      ...linkSessions.map((row) => ({
        kind: 'link' as const,
        orderId: row.order_id,
        orderNo: row.order_no,
        customerName: row.customer_name,
        productName: row.item_name,
        startAt: new Date(Number(row.session_at) * 1000).toISOString(),
        endAt: new Date((Number(row.session_at) + Number(row.session_hours ?? 1) * 3600) * 1000).toISOString(),
      })),
    ].sort((a, b) => a.startAt.localeCompare(b.startAt)),
    calendarEvents: calendarImport.events,
    calendarError: calendarImport.error,
    queues: {
      mixingReceived: countOf(mixingCounts, 'received'),
      mixingInProgress: countOf(mixingCounts, 'in_progress'),
      subscriptionsPendingCard: countOf(subscriptionCounts, 'pending_card'),
      subscriptionsPastDue: countOf(subscriptionCounts, 'past_due'),
      subscriptionsPaused: countOf(subscriptionCounts, 'paused'),
      contractsAwaitingSignature: Number(contractRows[0]?.count ?? 0),
      artistPayoutsPending,
      fundingProjectsAwaitingReview: Number(fundingReviewRows[0]?.count ?? 0),
      fundingPayoutsPending,
      fundingPayoutsToRecord,
      shopPayoutsToRecord,
      shopPayoutsPending,
      showPayoutsToRecord,
      showPayoutsPending,
      awaitingDeposit: {
        bookings: Number(awaitingDepositRows.find((r) => r.kind === 'bookings')?.n ?? 0),
        shows: Number(awaitingDepositRows.find((r) => r.kind === 'shows')?.n ?? 0),
        shop: Number(awaitingDepositRows.find((r) => r.kind === 'shop')?.n ?? 0),
        funding: Number(awaitingDepositRows.find((r) => r.kind === 'funding')?.n ?? 0),
      },
    },
    socialTokens: tokens.map((row) => ({
      platform: row.platform,
      expiresAt: new Date(row.expiresAt * 1000).toISOString(),
      daysLeft: Math.floor((row.expiresAt * 1000 - now.getTime()) / DAY_MS),
    })),
    upcomingWindowDays: UPCOMING_WINDOW_DAYS,
    checkedAt: now.toISOString(),
  };
};
