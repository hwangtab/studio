import { and, asc, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, contracts, fundingProjects, orders, socialTokens, subscriptions, workOrders } from '../../db/schema';
import { getProduct } from '../booking/products';
import { collectDbIssues, type HealthIssue } from './healthCheck';
import { countPendingArtistPayouts } from '../artistSupport/payout';

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
    /** 기록됐지만 아직 이체하지 않은 아티스트 정산. */
    artistPayoutsPending: number;
    /** 개설자가 제출해 운영자 승인을 기다리는 펀딩 프로젝트. */
    fundingProjectsAwaitingReview: number;
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

  const [issues, sessions, mixingCounts, subscriptionCounts, contractRows, tokens, artistPayoutsPending, fundingReviewRows] = await Promise.all([
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
  ]);

  const countOf = (rows: Array<{ status: string; count: number }>, status: string): number =>
    Number(rows.find((row) => row.status === status)?.count ?? 0);

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
      artistPayoutsPending,
      fundingProjectsAwaitingReview: Number(fundingReviewRows[0]?.count ?? 0),
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
