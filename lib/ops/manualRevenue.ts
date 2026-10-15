import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { manualRevenues, type ManualRevenue } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { REVENUE_TYPE_LABELS, type RevenueRow } from './revenueReport';

/**
 * 수기 매출 — 웹사이트를 거치지 않고 계좌·현금으로 받은 돈의 장부(db/schema.ts `manualRevenues`, 마이그레이션 0063).
 * 매출 현황(`revenueReport`)이 이 표를 같은 모집단에 합산한다. 주문·예약·메일은 만들지 않는다.
 *
 * 표가 없는 DB(마이그레이션 전)에서는 읽기가 던진다 — 호출부(매출 화면)가 잡아 "수기 매출을 불러오지 못했다"로 알린다.
 * 조용히 빈 목록을 돌려주면 직접 입금분이 통째로 없는 숫자를 정상으로 읽게 된다.
 */

export const MANUAL_TYPES = REVENUE_TYPE_LABELS;
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
  if (!(type in MANUAL_TYPES)) return { ok: false, message: '유형을 골라 주세요.' };

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

  return {
    ok: true,
    value: { receivedOn, type, description, totalAmount, vatMode, method: method as ManualMethod, memo: memoRaw || null },
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

/** 돌려준 누적 금액을 정한다(덮어쓰기). 총액을 넘으면 거절 — null이면 그 행이 없다. */
export const setManualRefund = async (id: string, refundedAmount: number): Promise<'ok' | 'not_found' | 'invalid'> => {
  const db = getDb();
  const row = await db.query.manualRevenues.findFirst({ where: eq(manualRevenues.id, id) });
  if (!row) return 'not_found';
  if (!Number.isInteger(refundedAmount) || refundedAmount < 0 || refundedAmount > row.totalAmount) return 'invalid';
  await db.update(manualRevenues).set({ refundedAmount }).where(eq(manualRevenues.id, id));
  return 'ok';
};

export const deleteManualRevenue = async (id: string): Promise<boolean> => {
  const deleted = await getDb().delete(manualRevenues).where(eq(manualRevenues.id, id)).returning({ id: manualRevenues.id });
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
    where: (t, { and, gte, lt }) => and(gte(t.receivedOn, from), lt(t.receivedOn, to)),
  });
  return rows.map(manualRevenueRow);
};
