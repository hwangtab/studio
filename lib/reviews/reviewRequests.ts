import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, reviewRequests, workOrders, type ReviewRequestKind } from '../../db/schema';
import { getSiteConfig } from '../../data/siteConfig';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO } from '../operatorContact';
import { isPurgedValue } from '../privacy/orderRetention';
import { getProduct } from '../booking/products';
import { getMixingProduct } from '../booking/mixing-products';
import { kstDateString } from '../booking/kst';

/**
 * 이용 후 후기 요청 메일 — 녹음 세션 다음 날, 믹싱·마스터링 납품 다음 날 한 번.
 *
 * **개인정보 처리방침 2항이 허용하는 범위만 보낸다.** 이 목적은 2026-09-26 처리방침 개정으로
 * 더해졌고, 그 전에 접수된 주문의 고객은 이 목적에 동의한 적이 없다. 그래서 주문 접수 시각이
 * REVIEW_REQUEST_ELIGIBLE_FROM 이후인 것만 대상이다 — 이 날짜를 앞당기면 옛 고객에게 동의 없는
 * 메일이 나간다. 처리방침 문구("한 건당 한 번", "다음 날", "혜택 없음")와 이 파일이 같은 약속을
 * 해야 한다.
 *
 * 추천·보증 심사지침: 후기에 혜택을 붙이지 않고, 좋은 후기를 유도하는 문구도 쓰지 않는다.
 */
export const REVIEW_REQUEST_ELIGIBLE_FROM = new Date('2026-09-27T00:00:00+09:00');

/** 끝나고 이만큼 지나야 보낸다 — "다음 날". 크론이 하루 한 번(11:00 KST) 돈다. */
export const REVIEW_REQUEST_MIN_DELAY_MS = 12 * 60 * 60 * 1000;
/** 이보다 오래된 이용은 보내지 않는다 — 크론이 며칠 멈췄다 돌아와도 한 달 전 손님에게 가지 않게. */
export const REVIEW_REQUEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** 같은 이메일로 이 기간 안에 이미 보냈으면 건너뛴다(연습실 단골에게 예약마다 가지 않게). */
export const REVIEW_REQUEST_PER_EMAIL_COOLDOWN_MS = 180 * 24 * 60 * 60 * 1000;
/** 한 번 실행에 보내는 상한 — 밀린 게 쌓였을 때 발신 도메인 평판을 한꺼번에 깎지 않게. */
export const REVIEW_REQUEST_BATCH_LIMIT = 20;

const EXCLUDED_SERVICES = ['smoke-test'];

export type ReviewCandidate = {
  kind: ReviewRequestKind;
  refId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  /** 메일 본문에 쓰는 상품명과 날짜. */
  serviceLabel: string;
  dateLabel: string;
};

const windowBounds = (now: Date) => ({
  newest: new Date(now.getTime() - REVIEW_REQUEST_MIN_DELAY_MS),
  oldest: new Date(now.getTime() - REVIEW_REQUEST_MAX_AGE_MS),
});

/** 발송 대상 — 아직 기록이 없고, 같은 주소로 최근에 보낸 적이 없는 것. */
export const findReviewCandidates = async (now: Date): Promise<ReviewCandidate[]> => {
  const db = getDb();
  const { newest, oldest } = windowBounds(now);
  const cooldownSince = Math.floor((now.getTime() - REVIEW_REQUEST_PER_EMAIL_COOLDOWN_MS) / 1000);

  // 같은 이메일로 최근 보낸 적이 있으면 제외. 이메일은 orders에서 조인해 비교한다(여기 복사하지 않음).
  const recentlyAsked = (emailColumn: typeof orders.customerEmail) => sql`exists (
    select 1 from ${reviewRequests} rr join ${orders} o2 on o2.id = rr.order_id
    where o2.customer_email = ${emailColumn} and rr.sent_at >= ${cooldownSince}
  )`;

  const sessionRows = await db
    .select({ booking: bookings, order: orders })
    .from(bookings)
    .innerJoin(orders, eq(orders.id, bookings.orderId))
    .where(
      and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, REVIEW_REQUEST_ELIGIBLE_FROM),
        inArray(bookings.status, ['confirmed', 'completed']),
        lte(bookings.endAt, newest),
        gte(bookings.endAt, oldest),
        sql`${bookings.serviceType} not in (${sql.join(EXCLUDED_SERVICES.map((s) => sql`${s}`), sql`, `)})`,
        sql`not exists (select 1 from ${reviewRequests} rr where rr.kind = 'session' and rr.ref_id = ${bookings.id})`,
        sql`not ${recentlyAsked(orders.customerEmail)}`,
      ),
    );

  const mixingRows = await db
    .select({ work: workOrders, order: orders })
    .from(workOrders)
    .innerJoin(orders, eq(orders.id, workOrders.orderId))
    .where(
      and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, REVIEW_REQUEST_ELIGIBLE_FROM),
        eq(workOrders.status, 'delivered'),
        lte(workOrders.deliveredAt, newest),
        gte(workOrders.deliveredAt, oldest),
        sql`not exists (select 1 from ${reviewRequests} rr where rr.kind = 'mixing' and rr.ref_id = ${workOrders.id})`,
        sql`not ${recentlyAsked(orders.customerEmail)}`,
      ),
    );

  const candidates: ReviewCandidate[] = [
    ...sessionRows.map(({ booking, order }) => ({
      kind: 'session' as const,
      refId: booking.id,
      orderId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      serviceLabel: getProduct(booking.productId)?.nameKo ?? '녹음 세션',
      dateLabel: kstDateString(booking.startAt),
    })),
    ...mixingRows.map(({ work, order }) => ({
      kind: 'mixing' as const,
      refId: work.id,
      orderId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      serviceLabel: getMixingProduct(work.productId)?.nameKo ?? '믹싱·마스터링',
      dateLabel: work.deliveredAt ? kstDateString(work.deliveredAt) : '',
    })),
  ];

  // 같은 실행 안에서도 한 주소에는 한 통만 — 세션과 믹싱이 같은 날 겹치는 손님.
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = c.customerEmail.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildReviewRequestEmail = (c: ReviewCandidate) => {
  // 네이버는 사람이 누르는 단축 링크(naverMapUrl) — naverPlaceUrl은 JSON-LD sameAs 전용 정본이다.
  const { googleReviewUrl, naverMapUrl } = getSiteConfig('ko').contact;
  const opening =
    c.kind === 'session'
      ? `${c.dateLabel} ${c.serviceLabel} 세션은 잘 마무리되셨는지 궁금합니다.`
      : `보내드린 ${c.serviceLabel} 결과물은 받아 보셨는지 궁금합니다.`;
  return {
    subject: '[스튜디오 놀] 이용은 어떠셨나요?',
    text: [
      `${c.customerName}님, 스튜디오 놀을 이용해 주셔서 고맙습니다.`,
      '',
      opening,
      '겪으신 그대로 짧게 남겨 주시면, 스튜디오를 고르는 다른 분들께 큰 도움이 됩니다.',
      '',
      `구글 리뷰: ${googleReviewUrl}`,
      `네이버 플레이스: ${naverMapUrl}`,
      '',
      '아쉬웠던 점이 있다면 이 메일에 답장으로 알려 주세요. 직접 읽고 답드립니다.',
      '',
      '이 안내는 이번 예약·주문에 대해 한 번만 보내드립니다.',
      '스튜디오 놀',
    ].join('\n'),
  };
};

export type ReviewRunResult = { sent: number; skipped: number; failed: { refId: string; code: string }[] };

/**
 * 대상 찾기 → 기록 선점 → 발송 → 실패면 기록 되돌림.
 *
 * 기록을 **먼저** 넣는 이유: 크론이 겹쳐 두 번 돌아도 한 통만 나가게. 넣기에 실패하면(이미 있음)
 * 그 건은 다른 실행이 가져간 것이라 건너뛴다. 발송이 실패하면 기록을 지워, 7일 창 안의 다음
 * 실행이 다시 시도하게 한다.
 */
export const runReviewRequests = async (now: Date): Promise<ReviewRunResult> => {
  const db = getDb();
  const candidates = (await findReviewCandidates(now)).slice(0, REVIEW_REQUEST_BATCH_LIMIT);
  const result: ReviewRunResult = { sent: 0, skipped: 0, failed: [] };

  for (const c of candidates) {
    if (isPurgedValue(c.customerEmail)) {
      result.skipped += 1;
      continue;
    }
    const claimed = await db
      .insert(reviewRequests)
      .values({ kind: c.kind, refId: c.refId, orderId: c.orderId, sentAt: now })
      .onConflictDoNothing()
      .returning({ refId: reviewRequests.refId });
    if (claimed.length === 0) {
      result.skipped += 1;
      continue;
    }
    const mail = buildReviewRequestEmail(c);
    const r = await sendEmail({ to: c.customerEmail, replyTo: CUSTOMER_REPLY_TO, ...mail });
    if (r.ok) {
      result.sent += 1;
    } else {
      await db
        .delete(reviewRequests)
        .where(and(eq(reviewRequests.kind, c.kind), eq(reviewRequests.refId, c.refId)));
      result.failed.push({ refId: c.refId, code: r.errorCode ?? 'API_ERROR' });
    }
  }
  return result;
};
