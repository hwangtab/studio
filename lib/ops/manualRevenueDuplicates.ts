import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';

/**
 * 수기 매출 **중복 의심** — 같은 돈을 사이트 주문과 수기 매출에 두 번 적었을 가능성(2026-10-21 감사).
 * 수기 매출은 주문과 연결하지 않으므로(manualRevenue.ts), 계좌 입금으로 받은 예약을 "입금 확인"으로 처리하고 수기로도 적으면 매출이 두 배가 된다.
 *
 * 판정(같은 총액, 부가세 포함):
 * - 사이트 주문: 세션 예약·믹싱·결제 링크(예약금) 중 결제(승인·입금 확인) 시각이 받은 날 **±3일**(KST 달력) 안에 있고 지금 결제 완료 상태인 것.
 * - 다른 수기 매출: **같은 날** 같은 금액(지우지 않은 것).
 *
 * **경고일 뿐 막지 않는다** — 같은 금액의 다른 거래는 흔하다(녹음 3시간 = 같은 값). 운영자가 확인했으면 수기 매출 메모에
 * `[중복 아님]`을 넣는다(저장 때 "그래도 저장"을 고르거나, 매출 현황 목록의 "중복 아님" 버튼). 그 표시가 있는 행은 운영 점검이 더 묻지 않는다.
 * 짝이 되는 다른 수기 매출 쪽에 표시가 있어도 그 쌍은 건너뛴다.
 */
export const DUPLICATE_ACK_MARKER = '[중복 아님]';
export const DUPLICATE_WINDOW_DAYS = 3;
export const DUPLICATE_ORDER_TYPES = ['session', 'mixing', 'deposit'] as const;

export interface DuplicateMatches {
  /** 같은 금액의 사이트 주문 번호. */
  orderNos: string[];
  /** 같은 날 같은 금액의 다른 수기 매출(id). */
  manualIds: string[];
}

const DAY = 86400;
const KST = 9 * 3600;

/** 'YYYY-MM-DD'(KST) 0시의 unix 초. */
const kstMidnightSec = (date: string): number => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000) - KST;

const typeList = sql.join(DUPLICATE_ORDER_TYPES.map((t) => sql`${t}`), sql`, `);

/** 저장하기 전 한 건의 중복 의심. 표가 없거나 조회가 실패하면 던진다 — 호출부가 잡아 경고 없이 저장한다. */
export const findManualRevenueDuplicates = async (input: { receivedOn: string; totalAmount: number; excludeId?: string }): Promise<DuplicateMatches> => {
  const db = getDb();
  const base = kstMidnightSec(input.receivedOn);
  const orders = await db.all<{ order_no: string }>(sql`
    SELECT DISTINCT o.order_no AS order_no FROM orders o JOIN payments p ON p.order_id = o.id
    WHERE o.type IN (${typeList}) AND o.status IN ('paid', 'partially_refunded') AND o.total_amount = ${input.totalAmount}
      AND p.approved_at IS NOT NULL AND p.approved_at >= ${base - DUPLICATE_WINDOW_DAYS * DAY} AND p.approved_at < ${base + (DUPLICATE_WINDOW_DAYS + 1) * DAY}
    ORDER BY o.order_no LIMIT 10
  `);
  const manuals = await db.all<{ id: string }>(sql`
    SELECT id FROM manual_revenues
    WHERE deleted_at IS NULL AND received_on = ${input.receivedOn} AND total_amount = ${input.totalAmount} AND id <> ${input.excludeId ?? ''}
    ORDER BY id LIMIT 10
  `);
  return { orderNos: orders.map((o) => o.order_no), manualIds: manuals.map((m) => m.id) };
};

export interface DuplicateSuspect {
  manualId: string;
  receivedOn: string;
  totalAmount: number;
  description: string;
  orderNos: string[];
  /** 같은 날 같은 금액의 다른 수기 매출 — 화면 표기용 `MAN-XXXXXXXX`. */
  manualRefs: string[];
}

export const manualRef = (id: string): string => `MAN-${id.slice(0, 8).toUpperCase()}`;

/**
 * 받은 날이 [from, to] (KST 날짜, 양끝 포함) 안인 수기 매출 중 중복 의심 — `[중복 아님]` 표시가 없는 것만. 매출 현황 목록과 운영 점검이 쓴다.
 * 표가 없으면 던진다(호출부가 잡는다).
 */
export const listManualRevenueDuplicates = async (range: { from: string; to: string }): Promise<DuplicateSuspect[]> => {
  const db = getDb();
  const marker = `%${DUPLICATE_ACK_MARKER}%`;
  const withOrders = await db.all<{ id: string; received_on: string; total_amount: number; description: string; order_no: string }>(sql`
    SELECT DISTINCT m.id AS id, m.received_on AS received_on, m.total_amount AS total_amount, m.description AS description, o.order_no AS order_no
    FROM manual_revenues m
    JOIN orders o ON o.total_amount = m.total_amount AND o.type IN (${typeList}) AND o.status IN ('paid', 'partially_refunded')
    JOIN payments p ON p.order_id = o.id AND p.approved_at IS NOT NULL
      AND p.approved_at >= unixepoch(m.received_on) - ${KST} - ${DUPLICATE_WINDOW_DAYS * DAY}
      AND p.approved_at < unixepoch(m.received_on) - ${KST} + ${(DUPLICATE_WINDOW_DAYS + 1) * DAY}
    WHERE m.deleted_at IS NULL AND m.received_on >= ${range.from} AND m.received_on <= ${range.to}
      AND (m.memo IS NULL OR m.memo NOT LIKE ${marker})
    ORDER BY m.received_on, m.id, o.order_no LIMIT 200
  `);
  const withManuals = await db.all<{ id: string; received_on: string; total_amount: number; description: string; other_id: string }>(sql`
    SELECT m.id AS id, m.received_on AS received_on, m.total_amount AS total_amount, m.description AS description, m2.id AS other_id
    FROM manual_revenues m
    JOIN manual_revenues m2 ON m2.id <> m.id AND m2.received_on = m.received_on AND m2.total_amount = m.total_amount AND m2.deleted_at IS NULL
      AND (m2.memo IS NULL OR m2.memo NOT LIKE ${marker})
    WHERE m.deleted_at IS NULL AND m.received_on >= ${range.from} AND m.received_on <= ${range.to}
      AND (m.memo IS NULL OR m.memo NOT LIKE ${marker})
    ORDER BY m.received_on, m.id, m2.id LIMIT 200
  `);
  const byId = new Map<string, DuplicateSuspect>();
  const entry = (r: { id: string; received_on: string; total_amount: number; description: string }) => {
    const found = byId.get(r.id) ?? { manualId: r.id, receivedOn: r.received_on, totalAmount: Number(r.total_amount), description: r.description, orderNos: [], manualRefs: [] };
    byId.set(r.id, found);
    return found;
  };
  for (const r of withOrders) entry(r).orderNos.push(r.order_no);
  for (const r of withManuals) entry(r).manualRefs.push(manualRef(r.other_id));
  return [...byId.values()].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.manualId.localeCompare(b.manualId));
};

/** 중복 경고 문구 — 저장 API와 화면이 같은 말을 쓴다. */
export const describeDuplicateMatches = (m: { orderNos: string[]; manualRefs: string[] }): string => {
  const parts: string[] = [];
  if (m.orderNos.length > 0) parts.push(`사이트 주문 ${m.orderNos.join(', ')}(±${DUPLICATE_WINDOW_DAYS}일 안, 같은 금액)`);
  if (m.manualRefs.length > 0) parts.push(`같은 날 같은 금액의 직접 기록 ${m.manualRefs.join(', ')}`);
  return parts.join(' · ');
};
