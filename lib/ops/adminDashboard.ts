import { and, asc, eq, gt, gte, inArray, isNull, lt, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, contracts, fundingPledges, fundingProjects, orders, socialTokens, subscriptions, workOrders } from '../../db/schema';
import { getProduct } from '../booking/products';
import { unmarkedSessionRange } from '../booking/unmarkedSessions';
import { terminationCutoff } from '../contracts/status';
import { collectDbIssues, type HealthIssue } from './healthCheck';
import { countPendingArtistPayouts } from '../artistSupport/payout';
import { countPendingFundingPayouts } from '../funding/payout';
import { countPendingSubmissions } from '../shows/organizer/adminSubmissions';

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

export interface UpcomingSession {
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

export interface AdminDashboard {
  issues: HealthIssue[];
  /** 오늘(KST 0시)부터 7일 안의 확정 세션, 시작 시각순. */
  upcomingSessions: UpcomingSession[];
  queues: {
    mixingReceived: number;
    mixingInProgress: number;
    subscriptionsPendingCard: number;
    subscriptionsPastDue: number;
    subscriptionsPaused: number;
    contractsAwaitingSignature: number;
    /** 끝난 지 7일 안인데 완료·노쇼 표시가 없는 세션 — 노쇼 고객에게 후기 요청 메일이 가기 전에 표시해야 한다. */
    sessionsAwaitingMark: number;
    /** 서명됐고 종료일이 지났는데 종료 처리가 없는 계약 — 처리하기 전엔 그 호실로 새 계약을 만들 수 없다. */
    contractsAwaitingTermination: number;
    /** 기록됐지만 아직 이체하지 않은 아티스트 정산. */
    artistPayoutsPending: number;
    /** 개설자가 제출해 운영자 승인을 기다리는 펀딩 프로젝트. */
    fundingProjectsAwaitingReview: number;
    /** 기록됐지만 아직 개설자에게 이체하지 않은 펀딩 정산. */
    fundingPayoutsPending: number;
    /** 계좌 입금 대기 — 통장에서 입금을 확인해 눌러야 확정된다(자동 취소가 없어 방치되면 자리만 잡는다). */
    depositsBooking: number;
    depositsShow: number;
    depositsFunding: number;
    /** 계좌 입금 후원자의 환불 요청 — 약관 제10조의 3영업일 기한이 있다. */
    fundingRefundRequests: number;
    /** 주최자가 제출해 운영자 심사를 기다리는 공연. 표(0055)가 없으면 null — 그 카드는 숨긴다. */
    showSubmissionsAwaitingReview: number | null;
  };
  socialTokens: SocialTokenStatus[];
  /** upcomingSessions의 창 길이(일). 화면 문구용 — 페이지가 이 모듈을 값으로 import하지 않게 데이터에 싣는다. */
  upcomingWindowDays: number;
  checkedAt: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const UPCOMING_WINDOW_DAYS = 7;

/** KST 달력의 오늘 0시(UTC Date). 이미 시작한 오늘 세션도 목록에 남긴다. */
const startOfTodayKst = (now: Date): Date => {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
};

export const loadAdminDashboard = async (now: Date = new Date()): Promise<AdminDashboard> => {
  const db = getDb();

  const from = startOfTodayKst(now);
  const to = new Date(from.getTime() + UPCOMING_WINDOW_DAYS * DAY_MS);

  const [issues, sessions, mixingCounts, subscriptionCounts, contractRows, tokens, artistPayoutsPending, fundingReviewRows, fundingPayoutsPending, unmarkedRows, terminationRows, depositRows, fundingDepositRows, fundingRefundRows, showSubmissionsAwaitingReview] = await Promise.all([
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
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(eq(bookings.status, 'confirmed'), gte(bookings.endAt, unmarkedSessionRange(now).from), lt(bookings.endAt, now))),
    // 판정은 lib/contracts/status.ts의 needsTermination과 같은 경계(terminationCutoff)다.
    db
      .select({ count: sql<number>`count(*)` })
      .from(contracts)
      .where(and(eq(contracts.status, 'signed'), isNull(contracts.terminatedAt), lt(contracts.endDate, terminationCutoff(now) ?? from))),
    db
      .select({ type: orders.type, count: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.status, 'awaiting_deposit'), inArray(orders.type, ['session', 'mixing', 'deposit', 'ticket'])))
      .groupBy(orders.type),
    // 펀딩 계좌 입금 대기는 orders.status가 아니라 pending + 결제수단으로 가른다(lib/funding/admin-list.ts와 같은 판정).
    db
      .select({ count: sql<number>`count(*)` })
      .from(fundingPledges)
      .innerJoin(orders, eq(orders.id, fundingPledges.orderId))
      .where(and(eq(orders.status, 'pending'), eq(fundingPledges.paymentMethod, 'bank_transfer'), eq(fundingPledges.entrySource, 'online'))),
    // 환불이 끝나면(refunded) 꺼져야 한다 — 시각은 환불 뒤에도 남으므로 paid만 센다(admin-serialize.refundRequested).
    db
      .select({ count: sql<number>`count(*)` })
      .from(fundingPledges)
      .innerJoin(orders, eq(orders.id, fundingPledges.orderId))
      .where(and(eq(orders.status, 'paid'), sql`${fundingPledges.refundRequestedAt} IS NOT NULL`)),
    countPendingSubmissions().catch((error: unknown) => {
      console.error('[admin] 공연 심사 대기 건수를 읽지 못했습니다:', error);
      return null;
    }),
  ]);

  const countOf = (rows: Array<{ status: string; count: number }>, status: string): number =>
    Number(rows.find((row) => row.status === status)?.count ?? 0);

  const depositCount = (rows: Array<{ type: string; count: number }>, type: string): number =>
    Number(rows.find((row) => row.type === type)?.count ?? 0);

  return {
    issues,
    upcomingSessions: sessions.map((row) => ({
      orderId: row.orderId,
      orderNo: row.orderNo,
      customerName: row.customerName,
      productName: getProduct(row.productId)?.nameKo ?? row.productId,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
    })),
    queues: {
      mixingReceived: countOf(mixingCounts, 'received'),
      mixingInProgress: countOf(mixingCounts, 'in_progress'),
      subscriptionsPendingCard: countOf(subscriptionCounts, 'pending_card'),
      subscriptionsPastDue: countOf(subscriptionCounts, 'past_due'),
      subscriptionsPaused: countOf(subscriptionCounts, 'paused'),
      contractsAwaitingSignature: Number(contractRows[0]?.count ?? 0),
      sessionsAwaitingMark: Number(unmarkedRows[0]?.count ?? 0),
      contractsAwaitingTermination: Number(terminationRows[0]?.count ?? 0),
      artistPayoutsPending,
      fundingProjectsAwaitingReview: Number(fundingReviewRows[0]?.count ?? 0),
      fundingPayoutsPending,
      depositsBooking: depositCount(depositRows, 'session') + depositCount(depositRows, 'mixing') + depositCount(depositRows, 'deposit'),
      depositsShow: depositCount(depositRows, 'ticket'),
      depositsFunding: Number(fundingDepositRows[0]?.count ?? 0),
      fundingRefundRequests: Number(fundingRefundRows[0]?.count ?? 0),
      showSubmissionsAwaitingReview,
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
