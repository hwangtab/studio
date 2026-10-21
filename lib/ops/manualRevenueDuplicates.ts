import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { safeDbErrorSummary } from '../payments/dbErrorSummary';
import { type BusinessLine, DEFAULT_LINE_OF_TYPE, lineOfType } from './businessLine';
import { DUPLICATE_ACK_MARKER as ACK_MARKER } from './memoTrail';

/**
 * 수기 매출 **중복 의심** — 같은 돈을 사이트가 이미 매출로 세고 있는데 수기로도 적었을 가능성(2026-10-21 감사).
 * 수기 매출은 주문과 연결하지 않으므로(manualRevenue.ts), 계좌 입금으로 받은 예약을 "입금 확인"으로 처리하고 수기로도 적으면 매출이 두 배가 된다.
 *
 * 판정(같은 총액, 부가세 포함) — 받은 날 **±3일**(KST 달력) 창:
 * - 사이트 주문: 세션 예약·믹싱·결제 링크(예약금) 중 지금 결제 완료 상태인 것. 계좌 입금 주문의 결제 시각은 운영자가 입금을 **확인한** 때라 신청 날과
 *   며칠 다를 수 있어(lib/booking/bankDeposit.ts) **주문 생성 시각이나 결제 시각 중 하나**가 창 안이면 맞춘다.
 * - 제작·믹싱 계약 입금: 진행 기록 `payment_received`(무효 처리 안 한 것, 결제 링크로 받은 건 주문 쪽에서 잡히므로 제외) — 기록 시각이 창 안.
 * - 월 입주 월 이용료: 분야가 **연습실**(고른 분야 또는 유형 기본)인 수기 매출이 받은 달에 입주해 있는 입주자의 월 이용료와 같은 금액이면
 *   (월 입주 이용료는 입주 기록에서 자동으로 매출에 잡힌다 — tenancyRevenue.ts). 방 번호만 싣는다(이름 없음).
 * - 다른 수기 매출: **같은 날** 같은 금액(지우지 않은 것).
 *
 * **경고일 뿐 막지 않는다** — 같은 금액의 다른 거래는 흔하다(녹음 3시간 = 같은 값). 운영자가 확인했으면 수기 매출 메모에
 * `[중복 아님]`을 넣는다(저장 때 "그래도 저장"을 고르거나, 매출 현황 목록의 "중복 아님" 버튼). 그 표시가 있는 행은 운영 점검이 더 묻지 않는다.
 * 짝이 되는 다른 수기 매출 쪽에 표시가 있어도 그 쌍은 건너뛴다.
 */
export const DUPLICATE_ACK_MARKER = ACK_MARKER;
export const DUPLICATE_WINDOW_DAYS = 3;
export const DUPLICATE_ORDER_TYPES = ['session', 'mixing', 'deposit'] as const;

export interface DuplicateMatches {
  /** 같은 금액의 사이트 주문 번호. */
  orderNos: string[];
  /** 같은 금액의 제작·믹싱 계약 입금 기록 — 화면 표기용 `PC-XXXXXXXX`(매출 현황의 계약 행과 같은 번호). */
  contractRefs: string[];
  /** 분야가 연습실일 때, 그 달에 입주해 있고 월 이용료가 같은 입주 기록의 방 번호(비상주는 '비상주'). */
  tenancyRooms: string[];
  /** 같은 날 같은 금액의 다른 수기 매출(id). */
  manualIds: string[];
}

const DAY = 86400;
const KST = 9 * 3600;

/** 'YYYY-MM-DD'(KST) 0시의 unix 초. */
const kstMidnightSec = (date: string): number => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000) - KST;

const typeList = sql.join(DUPLICATE_ORDER_TYPES.map((t) => sql`${t}`), sql`, `);
/** 유형만으로 연습실로 세는 유형(분야를 따로 고르지 않았을 때). */
const practiceTypeList = sql.join(
  Object.entries(DEFAULT_LINE_OF_TYPE).filter(([, line]) => line === 'practice').map(([type]) => sql`${type}`),
  sql`, `,
);

/** 월 입주(tenancyRevenue.ts)와 같은 "그 달에 하루라도 입주해 있다" 조건. `month`는 'YYYY-MM-DD' 아무 날(그 달 판정용). */
const tenancyInMonth = (receivedOn: ReturnType<typeof sql>) => sql`
  t.monthly_amount > 0
  AND t.start_date <= date(substr(${receivedOn}, 1, 7) || '-01', '+1 month', '-1 day')
  AND (CASE WHEN t.status = 'ended'
      THEN COALESCE(t.ended_on, (SELECT MAX(p2.paid_on) FROM room_tenancy_payments p2 WHERE p2.tenancy_id = t.id), t.start_date)
      ELSE NULL END IS NULL
    OR CASE WHEN t.status = 'ended'
      THEN COALESCE(t.ended_on, (SELECT MAX(p2.paid_on) FROM room_tenancy_payments p2 WHERE p2.tenancy_id = t.id), t.start_date)
      ELSE NULL END >= substr(${receivedOn}, 1, 7) || '-01')
`;

/** 선택 점검(계약·월 입주) 조회가 실패하면(표 없음 등) 그 점검만 건너뛴다 — 주문·수기 점검은 그대로다. */
const optional = async <T>(label: string, run: () => Promise<T[]>): Promise<T[]> => {
  try {
    return await run();
  } catch (error) {
    console.error(`[manual-revenue/duplicates] ${label} 점검 실패 — 건너뜁니다:`, safeDbErrorSummary(error));
    return [];
  }
};

/**
 * 저장하기 전 한 건의 중복 의심. 주문·수기 조회가 실패하면 던진다 — 호출부가 잡아 경고 없이 저장한다.
 * `businessLine`(고른 분야)·`type`을 주면 연습실 월 입주 이용료와도 견준다.
 */
export const findManualRevenueDuplicates = async (input: {
  receivedOn: string;
  totalAmount: number;
  excludeId?: string;
  type?: string;
  businessLine?: BusinessLine | null;
}): Promise<DuplicateMatches> => {
  const db = getDb();
  const base = kstMidnightSec(input.receivedOn);
  const lo = base - DUPLICATE_WINDOW_DAYS * DAY;
  const hi = base + (DUPLICATE_WINDOW_DAYS + 1) * DAY;
  const orders = await db.all<{ order_no: string }>(sql`
    SELECT DISTINCT o.order_no AS order_no FROM orders o JOIN payments p ON p.order_id = o.id
    WHERE o.type IN (${typeList}) AND o.status IN ('paid', 'partially_refunded') AND o.total_amount = ${input.totalAmount}
      AND ((p.approved_at IS NOT NULL AND p.approved_at >= ${lo} AND p.approved_at < ${hi}) OR (o.created_at >= ${lo} AND o.created_at < ${hi}))
    ORDER BY o.order_no LIMIT 10
  `);
  const manuals = await db.all<{ id: string }>(sql`
    SELECT id FROM manual_revenues
    WHERE deleted_at IS NULL AND received_on = ${input.receivedOn} AND total_amount = ${input.totalAmount} AND id <> ${input.excludeId ?? ''}
    ORDER BY id LIMIT 10
  `);
  const contracts = await optional('계약 입금', () => db.all<{ ref: string }>(sql`
    SELECT DISTINCT 'PC-' || upper(substr(e.contract_id, 1, 8)) AS ref FROM production_contract_events e
    WHERE e.type = 'payment_received' AND e.amount = ${input.totalAmount} AND e.occurred_at >= ${lo} AND e.occurred_at < ${hi}
      AND (e.data_json IS NULL OR e.data_json NOT LIKE '%"orderNo"%')
      AND NOT EXISTS (SELECT 1 FROM production_contract_events v WHERE v.type = 'void' AND v.voids_event_id = e.id)
    ORDER BY ref LIMIT 10
  `));
  const line = input.businessLine ?? (input.type ? lineOfType(input.type) : null);
  const rooms =
    line === 'practice'
      ? await optional('월 입주', () => db.all<{ room: string }>(sql`
          SELECT DISTINCT COALESCE(t.room_number, '비상주') AS room FROM room_tenancies t
          WHERE t.monthly_amount = ${input.totalAmount} AND ${tenancyInMonth(sql`${input.receivedOn}`)}
          ORDER BY room LIMIT 10
        `))
      : [];
  return {
    orderNos: orders.map((o) => o.order_no),
    contractRefs: contracts.map((c) => c.ref),
    tenancyRooms: rooms.map((r) => r.room),
    manualIds: manuals.map((m) => m.id),
  };
};

export const hasDuplicateMatches = (m: DuplicateMatches): boolean =>
  m.orderNos.length > 0 || m.contractRefs.length > 0 || m.tenancyRooms.length > 0 || m.manualIds.length > 0;

export interface DuplicateSuspect {
  manualId: string;
  receivedOn: string;
  totalAmount: number;
  description: string;
  orderNos: string[];
  contractRefs: string[];
  tenancyRooms: string[];
  /** 같은 날 같은 금액의 다른 수기 매출 — 화면 표기용 `MAN-XXXXXXXX`. */
  manualRefs: string[];
}

export const manualRef = (id: string): string => `MAN-${id.slice(0, 8).toUpperCase()}`;

/**
 * 받은 날이 [from, to] (KST 날짜, 양끝 포함) 안인 수기 매출 중 중복 의심 — `[중복 아님]` 표시가 없는 것만. 매출 현황 목록과 운영 점검이 쓴다.
 * 수기 매출·주문 표가 없으면 던진다(호출부가 잡는다). 계약·월 입주 점검은 표가 없으면 그 점검만 건너뛴다.
 */
export const listManualRevenueDuplicates = async (range: { from: string; to: string }): Promise<DuplicateSuspect[]> => {
  const db = getDb();
  const marker = `%${DUPLICATE_ACK_MARKER}%`;
  const dayStart = sql`unixepoch(m.received_on) - ${KST}`;
  const lo = sql`${dayStart} - ${DUPLICATE_WINDOW_DAYS * DAY}`;
  const hi = sql`${dayStart} + ${(DUPLICATE_WINDOW_DAYS + 1) * DAY}`;
  type Base = { id: string; received_on: string; total_amount: number; description: string };
  const withOrders = await db.all<Base & { order_no: string }>(sql`
    SELECT DISTINCT m.id AS id, m.received_on AS received_on, m.total_amount AS total_amount, m.description AS description, o.order_no AS order_no
    FROM manual_revenues m
    JOIN orders o ON o.total_amount = m.total_amount AND o.type IN (${typeList}) AND o.status IN ('paid', 'partially_refunded')
    JOIN payments p ON p.order_id = o.id
      AND ((p.approved_at IS NOT NULL AND p.approved_at >= ${lo} AND p.approved_at < ${hi}) OR (o.created_at >= ${lo} AND o.created_at < ${hi}))
    WHERE m.deleted_at IS NULL AND m.received_on >= ${range.from} AND m.received_on <= ${range.to}
      AND (m.memo IS NULL OR m.memo NOT LIKE ${marker})
    ORDER BY m.received_on, m.id, o.order_no LIMIT 200
  `);
  const withContracts = await optional('계약 입금', () => db.all<Base & { ref: string }>(sql`
    SELECT DISTINCT m.id AS id, m.received_on AS received_on, m.total_amount AS total_amount, m.description AS description,
      'PC-' || upper(substr(e.contract_id, 1, 8)) AS ref
    FROM manual_revenues m
    JOIN production_contract_events e ON e.type = 'payment_received' AND e.amount = m.total_amount AND e.occurred_at >= ${lo} AND e.occurred_at < ${hi}
      AND (e.data_json IS NULL OR e.data_json NOT LIKE '%"orderNo"%')
      AND NOT EXISTS (SELECT 1 FROM production_contract_events v WHERE v.type = 'void' AND v.voids_event_id = e.id)
    WHERE m.deleted_at IS NULL AND m.received_on >= ${range.from} AND m.received_on <= ${range.to}
      AND (m.memo IS NULL OR m.memo NOT LIKE ${marker})
    ORDER BY m.received_on, m.id, ref LIMIT 200
  `));
  const tenancyQuery = (withAssignments: boolean) => withAssignments
    ? sql`
        SELECT DISTINCT m.id AS id, m.received_on AS received_on, m.total_amount AS total_amount, m.description AS description, COALESCE(t.room_number, '비상주') AS room
        FROM manual_revenues m
        LEFT JOIN revenue_line_assignments a ON a.subject_kind = 'manual_revenue' AND a.subject_id = m.id
        JOIN room_tenancies t ON t.monthly_amount = m.total_amount AND ${tenancyInMonth(sql`m.received_on`)}
        WHERE m.deleted_at IS NULL AND m.received_on >= ${range.from} AND m.received_on <= ${range.to}
          AND (m.memo IS NULL OR m.memo NOT LIKE ${marker})
          AND (a.business_line = 'practice' OR (a.business_line IS NULL AND m.type IN (${practiceTypeList})))
        ORDER BY m.received_on, m.id, room LIMIT 200`
    : sql`
        SELECT DISTINCT m.id AS id, m.received_on AS received_on, m.total_amount AS total_amount, m.description AS description, COALESCE(t.room_number, '비상주') AS room
        FROM manual_revenues m
        JOIN room_tenancies t ON t.monthly_amount = m.total_amount AND ${tenancyInMonth(sql`m.received_on`)}
        WHERE m.deleted_at IS NULL AND m.received_on >= ${range.from} AND m.received_on <= ${range.to}
          AND (m.memo IS NULL OR m.memo NOT LIKE ${marker}) AND m.type IN (${practiceTypeList})
        ORDER BY m.received_on, m.id, room LIMIT 200`;
  let withTenancy: Array<Base & { room: string }> = [];
  try {
    withTenancy = await db.all<Base & { room: string }>(tenancyQuery(true));
  } catch {
    // 분야 지정 표(0084)가 없는 DB — 유형 기본 분야로만 본다.
    withTenancy = await optional('월 입주', () => db.all<Base & { room: string }>(tenancyQuery(false)));
  }
  const withManuals = await db.all<Base & { other_id: string }>(sql`
    SELECT m.id AS id, m.received_on AS received_on, m.total_amount AS total_amount, m.description AS description, m2.id AS other_id
    FROM manual_revenues m
    JOIN manual_revenues m2 ON m2.id <> m.id AND m2.received_on = m.received_on AND m2.total_amount = m.total_amount AND m2.deleted_at IS NULL
      AND (m2.memo IS NULL OR m2.memo NOT LIKE ${marker})
    WHERE m.deleted_at IS NULL AND m.received_on >= ${range.from} AND m.received_on <= ${range.to}
      AND (m.memo IS NULL OR m.memo NOT LIKE ${marker})
    ORDER BY m.received_on, m.id, m2.id LIMIT 200
  `);
  const byId = new Map<string, DuplicateSuspect>();
  const entry = (r: Base) => {
    const found = byId.get(r.id) ?? {
      manualId: r.id, receivedOn: r.received_on, totalAmount: Number(r.total_amount), description: r.description,
      orderNos: [], contractRefs: [], tenancyRooms: [], manualRefs: [],
    };
    byId.set(r.id, found);
    return found;
  };
  for (const r of withOrders) entry(r).orderNos.push(r.order_no);
  for (const r of withContracts) entry(r).contractRefs.push(r.ref);
  for (const r of withTenancy) entry(r).tenancyRooms.push(r.room);
  for (const r of withManuals) entry(r).manualRefs.push(manualRef(r.other_id));
  return [...byId.values()].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.manualId.localeCompare(b.manualId));
};

/** 중복 경고 문구 — 저장 API·화면·운영 점검이 같은 말을 쓴다. 이름·내용 같은 개인정보는 싣지 않는다(주문번호·계약 번호·방 번호·기록 번호뿐). */
export const describeDuplicateMatches = (m: { orderNos: string[]; contractRefs?: string[]; tenancyRooms?: string[]; manualRefs: string[] }): string => {
  const parts: string[] = [];
  if (m.orderNos.length > 0) parts.push(`사이트 주문 ${m.orderNos.join(', ')}(±${DUPLICATE_WINDOW_DAYS}일 안, 같은 금액)`);
  if ((m.contractRefs?.length ?? 0) > 0) parts.push(`제작·믹싱 계약 입금 ${m.contractRefs?.join(', ')}(±${DUPLICATE_WINDOW_DAYS}일 안, 같은 금액)`);
  if ((m.tenancyRooms?.length ?? 0) > 0) parts.push(`월 입주 ${m.tenancyRooms?.join(', ')}의 월 이용료와 같은 금액(월 입주 이용료는 자동으로 매출에 잡혀요)`);
  if (m.manualRefs.length > 0) parts.push(`같은 날 같은 금액의 직접 기록 ${m.manualRefs.join(', ')}`);
  return parts.join(' · ');
};
