import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { safeDbErrorSummary } from './refundAccount';

/**
 * 결제 링크 주문 ↔ 링크 연결(`payment_link_orders`, 마이그레이션 0061).
 *
 * 링크 주문(`orders.type = 'deposit'`)은 하위 표가 없어 **무슨 상품의 링크였는지**가 어디에도 남지 않았다 — 같은 고객에게 링크를
 * 여러 개 보내면 입금 확인·환불 때 어느 건인지 알 수 없었다. 주문을 만들 때 링크의 slug와 상품명(스냅샷)을 여기 남기고, 관리자 화면·
 * 운영자 알림이 읽는다. 메모(운영자용)는 링크 표(`payment_links`)에서 읽는다.
 *
 * **둘 다 실패를 삼킨다** — 표가 없는 DB(0061 전)에서도 결제·주문은 그대로 돈다(기록·표시만 빠진다). 쓰기는 주문 생성 직후에
 * 부르므로 입금 안내 메일이 상품명을 읽을 수 있다.
 */

export interface PaymentLinkOrderInfo {
  slug: string;
  itemName: string;
  /** 주문 시점의 이용 일시(초)·시간(0062) — 일시 없는 링크는 null. */
  sessionAt: number | null;
  sessionHours: number | null;
  /** 구글 캘린더에 올린 일정의 이벤트 id·마지막 실패 사유(0063) — 관리자 예약 상세가 상태를 보인다. */
  gcalEventId: string | null;
  gcalError: string | null;
  /** 링크를 만들 때 적은 운영자 메모(파일 링크·삭제된 행이면 null). */
  memo: string | null;
}

export const recordPaymentLinkOrder = async (input: {
  orderNo: string; slug: string; itemName: string; sessionAt?: number | null; sessionHours?: number | null;
}): Promise<void> => {
  try {
    await getDb().run(sql`
      INSERT INTO payment_link_orders (order_no, slug, item_name, session_at, session_hours)
      VALUES (${input.orderNo}, ${input.slug}, ${input.itemName}, ${input.sessionAt ?? null}, ${input.sessionHours ?? null})
      ON CONFLICT (order_no) DO NOTHING
    `);
  } catch (error) {
    console.error('[payment-link-orders] 링크 주문 기록 실패 — 주문은 그대로 진행한다', { orderNo: input.orderNo, error: safeDbErrorSummary(error) });
  }
};

/** 주문번호 → 링크 정보. 없거나(옛 주문·0061 전) 조회가 실패하면 빈 맵 — 화면은 "예약금"으로 내려간다. */
export const loadPaymentLinkOrderInfo = async (orderNos: readonly string[]): Promise<Map<string, PaymentLinkOrderInfo>> => {
  const out = new Map<string, PaymentLinkOrderInfo>();
  if (orderNos.length === 0) return out;
  try {
    const rows = await getDb().all<{ order_no: string; slug: string; item_name: string; session_at: number | null; session_hours: number | null; gcal_event_id: string | null; gcal_error: string | null; memo: string | null }>(sql`
      SELECT o.order_no, o.slug, o.item_name, o.session_at, o.session_hours, o.gcal_event_id, o.gcal_error, l.memo AS memo
      FROM payment_link_orders o LEFT JOIN payment_links l ON l.slug = o.slug
      WHERE o.order_no IN (${sql.join(orderNos.map((n) => sql`${n}`), sql`, `)})
    `);
    for (const r of rows) out.set(r.order_no, {
      slug: r.slug, itemName: r.item_name, memo: r.memo ?? null,
      sessionAt: r.session_at === null ? null : Number(r.session_at), sessionHours: r.session_hours === null ? null : Number(r.session_hours),
      gcalEventId: r.gcal_event_id ?? null, gcalError: r.gcal_error ?? null,
    });
  } catch (error) {
    console.error('[payment-link-orders] 링크 정보 조회 실패 — "예약금"으로 표시한다', { error: safeDbErrorSummary(error) });
  }
  return out;
};
