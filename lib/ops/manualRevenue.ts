import { and, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { manualRevenues, type ManualRevenue } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { BUSINESS_LINE_LABELS, lineOfType, parseBusinessLine, type BusinessLine } from './businessLine';
import { clearLineAssignment, loadLineAssignments, saveLineAssignment } from './businessLineStore';
import { appendMemoLine, DUPLICATE_ACK_MARKER, MEMO_CONFLICT, retryOnMemoConflict } from './memoTrail';
import { REVENUE_TYPE_LABELS, type RevenueRow } from './revenueReport';

/**
 * 수기 매출 — 웹사이트를 거치지 않고 계좌·현금으로 받은 돈의 장부(db/schema.ts `manualRevenues`, 마이그레이션 0063, 소프트 삭제 0065).
 * 매출 현황(`revenueReport`)이 이 표를 같은 모집단에 합산한다. 주문·예약·메일은 만들지 않는다.
 *
 * 표·삭제 칸이 없는 DB(마이그레이션 전)에서는 읽기가 던진다 — 호출부(매출 화면)가 잡아 "수기 매출을 불러오지 못했다"로 알린다.
 * 조용히 빈 목록을 돌려주면 직접 입금분이 통째로 없는 숫자를 정상으로 읽게 된다.
 */

// 월 입주(tenancyRevenue.ts)·레슨(lessonRevenue.ts)은 각자 관리 화면이 따로 읽는다 — 수기로 또 적으면 두 번 센다.
export const MANUAL_TYPES: Record<string, string> = Object.fromEntries(Object.entries(REVENUE_TYPE_LABELS).filter(([key]) => key !== 'tenancy' && key !== 'lesson'));
export const MANUAL_METHODS = ['계좌 입금', '현금'] as const;
export type ManualMethod = (typeof MANUAL_METHODS)[number];
export type VatMode = 'included' | 'exempt';

/** 한 건 상한 — 자릿수 실수(2,500,000을 25,000,000으로)를 걸러내는 안전판이지 사업 한도가 아니다. */
export const MANUAL_MAX_AMOUNT = 100_000_000;

export interface ManualRevenueInput {
  receivedOn: string;
  type: string;
  description: string;
  totalAmount: number;
  vatMode: VatMode;
  method: ManualMethod;
  memo: string | null;
  /** 사업 분야(선택). 비우면 유형의 기본 분야(lib/ops/businessLine.ts) — 따로 둔 표에 적는다(businessLineStore.ts, 0084). */
  businessLine?: BusinessLine | null;
}

type Parsed = { ok: true; value: ManualRevenueInput } | { ok: false; message: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

/** 부가세 포함 총액에서 부가세를 뽑는다 — 과세는 총액/11 반올림, 면세는 0. */
export const vatOf = (total: number, mode: VatMode): number => (mode === 'included' ? Math.round(total / 11) : 0);

export const parseManualRevenueInput = (raw: unknown, today: string): Parsed => {
  const body = (raw ?? {}) as Record<string, unknown>;
  const receivedOn = typeof body.receivedOn === 'string' ? body.receivedOn.trim() : '';
  if (!isRealDate(receivedOn)) return { ok: false, message: '받은 날짜를 YYYY-MM-DD로 적어 주세요.' };
  if (receivedOn > today) return { ok: false, message: '받은 날짜가 오늘보다 뒤일 수 없습니다.' };
  if (receivedOn < '2020-01-01') return { ok: false, message: '받은 날짜가 너무 오래됐습니다.' };

  const type = typeof body.type === 'string' ? body.type : '';
  if (!Object.hasOwn(MANUAL_TYPES, type)) return { ok: false, message: '유형을 골라 주세요.' };

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description === '') return { ok: false, message: '내용을 적어 주세요. (예: 녹음 3시간 — 김OO)' };
  if (description.length > 100) return { ok: false, message: '내용은 100자까지 적을 수 있습니다.' };

  const totalAmount = body.totalAmount;
  if (typeof totalAmount !== 'number' || !Number.isInteger(totalAmount) || totalAmount <= 0) {
    return { ok: false, message: '금액은 1원 이상의 정수여야 합니다.' };
  }
  if (totalAmount > MANUAL_MAX_AMOUNT) return { ok: false, message: '금액이 너무 큽니다. 자릿수를 확인해 주세요.' };

  const vatMode = body.vatMode;
  if (vatMode !== 'included' && vatMode !== 'exempt') return { ok: false, message: '부가세 구분을 골라 주세요.' };

  const method = body.method;
  if (!(MANUAL_METHODS as readonly unknown[]).includes(method)) return { ok: false, message: '받은 방법을 골라 주세요.' };

  const memoRaw = typeof body.memo === 'string' ? body.memo.trim() : '';
  if (memoRaw.length > 500) return { ok: false, message: '메모는 500자까지 적을 수 있습니다.' };

  const rawLine = body.businessLine;
  const businessLine = rawLine === undefined || rawLine === null || rawLine === '' ? null : parseBusinessLine(rawLine);
  if (businessLine === null && !(rawLine === undefined || rawLine === null || rawLine === '')) return { ok: false, message: '분야를 다시 골라 주세요.' };

  return {
    ok: true,
    value: { receivedOn, type, description, totalAmount, vatMode, method: method as ManualMethod, memo: memoRaw || null, businessLine },
  };
};

export const createManualRevenue = async (input: ManualRevenueInput, actor: string): Promise<string> => {
  const [row] = await getDb()
    .insert(manualRevenues)
    .values({
      receivedOn: input.receivedOn,
      type: input.type,
      description: input.description,
      totalAmount: input.totalAmount,
      vatAmount: vatOf(input.totalAmount, input.vatMode),
      method: input.method,
      memo: input.memo,
      createdBy: actor,
    })
    .returning({ id: manualRevenues.id });
  return row.id;
};

/**
 * 메모 끝에 한 줄을 붙인다 — 상한을 넘으면 오래된 기록 줄부터 버리고 운영자 메모·`[중복 아님]`은 지킨다(memoTrail.ts).
 * 읽은 메모가 그 사이 바뀌었으면(`memo IS <읽은 값>` 조건이 0행) 다시 읽어 붙인다 — 동시 요청이 서로의 기록 줄을 덮어쓰지 않게.
 */
const sameMemo = (memo: string | null) => sql`${manualRevenues.memo} IS ${memo}`;

/**
 * 돌려준 누적 금액을 정한다(덮어쓰기). 총액을 넘으면 거절 — 'not_found'면 그 행이 없다.
 *
 * 누가 언제 얼마에서 얼마로 바꿨는지를 메모 끝에 한 줄 남긴다(`actor`를 줄 때) — 이 표에는 수정 이력 칸이 없어, 바꾸고 나면
 * 이전 값을 알 길이 없었다. 삭제된 행(소프트 삭제, 0065)은 없는 것으로 본다.
 */
export const setManualRefund = async (id: string, refundedAmount: number, actor?: string): Promise<'ok' | 'not_found' | 'invalid'> => {
  const db = getDb();
  return retryOnMemoConflict<'ok' | 'not_found' | 'invalid'>(async () => {
    const row = await db.query.manualRevenues.findFirst({ where: and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt)) });
    if (!row) return 'not_found';
    if (!Number.isInteger(refundedAmount) || refundedAmount < 0 || refundedAmount > row.totalAmount) return 'invalid';
    const trail =
      actor && refundedAmount !== row.refundedAmount
        ? `[환불 ${row.refundedAmount.toLocaleString('ko-KR')}→${refundedAmount.toLocaleString('ko-KR')}원 · ${actor} · ${kstDateString(new Date())}]`
        : null;
    const memo = trail ? appendMemoLine(row.memo, trail) : row.memo;
    const updated = await db
      .update(manualRevenues)
      .set({ refundedAmount, memo })
      .where(and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt), sameMemo(row.memo), eq(manualRevenues.refundedAmount, row.refundedAmount)))
      .returning({ id: manualRevenues.id });
    return updated.length > 0 ? 'ok' : MEMO_CONFLICT;
  });
};

/**
 * 분야를 바꾼다(`line = null`이면 지정을 지워 유형의 기본 분야로). 분야는 따로 둔 표(0084)에 있어 그 표가 없으면 'unavailable'.
 * 바꾸기 전·후와 누가·언제를 메모 끝에 남긴다 — 분야 지정 표에는 이력 칸이 없다(businessLineStore.ts).
 */
export const setManualRevenueLine = async (id: string, line: BusinessLine | null, actor: string): Promise<'ok' | 'not_found' | 'unavailable' | 'unchanged'> => {
  const db = getDb();
  const row = await db.query.manualRevenues.findFirst({ where: and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt)) });
  if (!row) return 'not_found';
  const assigned = (await loadLineAssignments('manual_revenue', [id])).get(id) ?? null;
  const before = assigned ?? lineOfType(row.type);
  const after = line ?? lineOfType(row.type);
  if (assigned === line) return 'unchanged';
  const saved = line === null ? await clearLineAssignment('manual_revenue', id) : await saveLineAssignment('manual_revenue', id, line, actor);
  if (!saved) return 'unavailable';
  if (before !== after) {
    const trail = `[분야 변경 ${BUSINESS_LINE_LABELS[before]}→${BUSINESS_LINE_LABELS[after]}${line === null ? '(유형대로)' : ''} · ${actor} · ${kstDateString(new Date())}]`;
    await retryOnMemoConflict<'done'>(async () => {
      const current = await db.query.manualRevenues.findFirst({ where: and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt)) });
      if (!current) return 'done'; // 그 사이 지워졌다 — 남길 메모가 없다.
      const updated = await db
        .update(manualRevenues)
        .set({ memo: appendMemoLine(current.memo, trail) })
        .where(and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt), sameMemo(current.memo)))
        .returning({ id: manualRevenues.id });
      return updated.length > 0 ? 'done' : MEMO_CONFLICT;
    });
  }
  return 'ok';
};

/** 중복 의심(manualRevenueDuplicates.ts)을 확인했다는 표시 — 메모에 `[중복 아님]`을 붙인다. 이미 있으면 그대로. */
export const acknowledgeManualDuplicate = async (id: string, actor: string): Promise<boolean> => {
  const db = getDb();
  return retryOnMemoConflict<boolean>(async () => {
    const row = await db.query.manualRevenues.findFirst({ where: and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt)) });
    if (!row) return false;
    if (row.memo?.includes(DUPLICATE_ACK_MARKER)) return true;
    const updated = await db
      .update(manualRevenues)
      .set({ memo: appendMemoLine(row.memo, `${DUPLICATE_ACK_MARKER} ${actor} · ${kstDateString(new Date())}`) })
      .where(and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt), sameMemo(row.memo)))
      .returning({ id: manualRevenues.id });
    return updated.length > 0 ? true : MEMO_CONFLICT;
  });
};

/**
 * 소프트 삭제(마이그레이션 0065) — 행은 남기고 누가 언제 지웠는지만 적는다. 예전엔 행째 지워져 "누가 뭘 지웠나"를 알 길이 없었다.
 * 이미 지운 행은 다시 지우지 않는다(false) — 처음 지운 사람·시각이 덮이지 않게.
 */
export const deleteManualRevenue = async (id: string, actor: string): Promise<boolean> => {
  const deleted = await getDb()
    .update(manualRevenues)
    .set({ deletedAt: new Date(), deletedBy: actor })
    .where(and(eq(manualRevenues.id, id), isNull(manualRevenues.deletedAt)))
    .returning({ id: manualRevenues.id });
  return deleted.length > 0;
};

/** 받은 날 0시(KST)를 기준 시각으로 쓴다 — 하루 안의 시각을 따로 받지 않는다. */
export const manualRevenueRow = (row: ManualRevenue): RevenueRow => ({
  at: new Date(new Date(`${row.receivedOn}T00:00:00Z`).getTime() - 9 * 60 * 60 * 1000),
  orderNo: `MAN-${row.id.slice(0, 8).toUpperCase()}`,
  type: row.type,
  projectSlug: null,
  method: row.method,
  gross: row.totalAmount,
  vat: row.vatAmount,
  refunded: row.refundedAmount,
  offline: true,
  manualId: row.id,
  note: row.description,
  memo: row.memo,
});

export const loadManualRevenueRows = async (range: { from: Date; toExclusive: Date }): Promise<RevenueRow[]> => {
  const from = kstDateString(range.from);
  const to = kstDateString(range.toExclusive);
  const rows = await getDb().query.manualRevenues.findMany({
    where: (t, { and, gte, lt, isNull }) => and(gte(t.receivedOn, from), lt(t.receivedOn, to), isNull(t.deletedAt)),
  });
  // 분야 지정은 따로 둔 표에서 읽는다(0084 전이면 빈 지정 — 유형의 기본 분야로 센다).
  const lines = await loadLineAssignments('manual_revenue', rows.map((r) => r.id));
  return rows.map((r) => {
    const row = manualRevenueRow(r);
    const line = lines.get(r.id);
    return line ? { ...row, line } : row;
  });
};
