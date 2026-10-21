import { and, eq, gte, isNull } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { studioExpenses, type StudioExpense } from '../../db/schema';
import { kstDateString } from '../booking/kst';

/**
 * 지출 항목 — 임대료·청소비·공과금처럼 스튜디오가 쓴 돈(db/schema.ts `studioExpenses`, 마이그레이션 0080).
 * 매출 현황의 **연습실 손익**(월 입주 수입 − 연습실 지출)이 읽는다. 주문·결제와 연결하지 않는다(수기 매출과 같다).
 *
 * 반복(`repeatMonthly`)은 쓴 날의 달부터 `repeatUntil`이 속한 달까지(없으면 계속) **매달 같은 금액**이 나간 것으로 센다 — 임대료를 매달 적지 않게.
 * 그 달에 없는 날(31일)은 말일로 보정한다. 표가 없는 DB(0080 전)에서는 읽기가 던진다 — 호출부가 잡아 "지출 표 미적용"으로 알린다
 * (조용히 빈 목록을 돌려주면 지출이 없는 숫자를 정상으로 읽게 된다).
 */

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: '임대료',
  cleaning: '청소비',
  utilities: '공과금(전기·수도·인터넷)',
  maintenance: '수선·관리',
  supplies: '소모품',
  other: '기타',
};

export const EXPENSE_SCOPE_LABELS: Record<string, string> = {
  practice: '연습실',
  studio: '스튜디오 전체',
};

/** 한 건 상한 — 자릿수 실수를 걸러내는 안전판이지 사업 한도가 아니다. */
export const EXPENSE_MAX_AMOUNT = 100_000_000;

export interface ExpenseInput {
  spentOn: string;
  category: string;
  scope: string;
  description: string;
  amount: number;
  repeatMonthly: boolean;
  repeatUntil: string | null;
  memo: string | null;
}

type Parsed = { ok: true; value: ExpenseInput } | { ok: false; message: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export const parseExpenseInput = (raw: unknown, today: string): Parsed => {
  const b = (raw ?? {}) as Record<string, unknown>;
  const spentOn = typeof b.spentOn === 'string' ? b.spentOn.trim() : '';
  if (!isRealDate(spentOn)) return { ok: false, message: '날짜를 YYYY-MM-DD로 적어 주세요.' };
  if (spentOn < '2020-01-01') return { ok: false, message: '날짜가 너무 오래됐습니다.' };
  const repeatMonthly = b.repeatMonthly === true;
  // 반복이 아닌 지출은 미래 날짜로 못 적는다(안 쓴 돈을 장부에 올리지 않게). 반복은 시작일이 이미 지났을 때만(다음 달부터는 때가 되면 센다).
  if (spentOn > today) return { ok: false, message: '아직 오지 않은 날짜예요. 오늘까지로 적어 주세요.' };
  const category = typeof b.category === 'string' ? b.category : '';
  if (!(category in EXPENSE_CATEGORY_LABELS)) return { ok: false, message: '항목을 골라 주세요.' };
  const scope = typeof b.scope === 'string' ? b.scope : 'practice';
  if (!(scope in EXPENSE_SCOPE_LABELS)) return { ok: false, message: '구분(연습실·스튜디오 전체)을 골라 주세요.' };
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (description === '') return { ok: false, message: '내용을 적어 주세요. (예: 10월 임대료)' };
  if (description.length > 100) return { ok: false, message: '내용은 100자까지 적을 수 있습니다.' };
  const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount);
  if (b.amount === null || b.amount === '' || !Number.isInteger(amount) || amount < 1 || amount > EXPENSE_MAX_AMOUNT) {
    return { ok: false, message: `금액을 확인해 주세요(원 단위, ${EXPENSE_MAX_AMOUNT.toLocaleString('ko-KR')}원 이하).` };
  }
  let repeatUntil: string | null = null;
  if (repeatMonthly && typeof b.repeatUntil === 'string' && b.repeatUntil.trim() !== '') {
    repeatUntil = b.repeatUntil.trim();
    if (!isRealDate(repeatUntil)) return { ok: false, message: '반복 끝나는 날을 YYYY-MM-DD로 적어 주세요.' };
    if (repeatUntil < spentOn) return { ok: false, message: '반복 끝나는 날이 시작일보다 앞일 수 없어요.' };
  }
  const memo = typeof b.memo === 'string' && b.memo.trim() !== '' ? b.memo.trim().slice(0, 200) : null;
  return { ok: true, value: { spentOn, category, scope, description, amount, repeatMonthly, repeatUntil, memo } };
};

export interface ExpenseOccurrence {
  expenseId: string;
  /** 이 지출이 센 날(KST, 'YYYY-MM-DD'). */
  on: string;
  category: string;
  scope: string;
  description: string;
  amount: number;
  repeat: boolean;
}

const lastDayOf = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();
const pad = (n: number): string => String(n).padStart(2, '0');

type ExpenseLike = Pick<StudioExpense, 'id' | 'spentOn' | 'description' | 'amount' | 'repeatMonthly' | 'repeatUntil'> & { category: string; scope: string };

/** 지출 행들을 [from, toExclusive) (KST 날짜 문자열) 안의 발생 건으로 펼친다. 순수 함수. */
export const expandExpenses = (
  rows: readonly ExpenseLike[],
  from: string,
  toExclusive: string,
): ExpenseOccurrence[] => {
  const out: ExpenseOccurrence[] = [];
  const base = (r: (typeof rows)[number], on: string): ExpenseOccurrence => ({
    expenseId: r.id, on, category: r.category, scope: r.scope, description: r.description, amount: r.amount, repeat: r.repeatMonthly,
  });
  for (const r of rows) {
    if (!r.repeatMonthly) {
      if (r.spentOn >= from && r.spentOn < toExclusive) out.push(base(r, r.spentOn));
      continue;
    }
    const day = Number(r.spentOn.slice(8));
    let y = Number(r.spentOn.slice(0, 4));
    let m = Number(r.spentOn.slice(5, 7));
    const lastMonth = r.repeatUntil ? r.repeatUntil.slice(0, 7) : null;
    const windowEndMonth = toExclusive.slice(0, 7);
    // 안전판: 최대 20년치만 펼친다(반복 끝이 없는 행이 무한 루프를 만들지 않게 — 창 끝 달에서도 멈춘다).
    for (let i = 0; i < 240; i += 1) {
      const key = `${y}-${pad(m)}`;
      if (lastMonth && key > lastMonth) break;
      if (key > windowEndMonth) break;
      const on = `${key}-${pad(Math.min(day, lastDayOf(y, m)))}`;
      if (on >= from && on < toExclusive && on >= r.spentOn) out.push(base(r, on));
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  }
  return out.sort((a, b) => a.on.localeCompare(b.on) || a.expenseId.localeCompare(b.expenseId));
};

/** 삭제하지 않은 지출 행을 읽는다. 표가 없으면 던진다(위 설명). */
export const loadExpenseRows = async (): Promise<StudioExpense[]> =>
  getDb().select().from(studioExpenses).where(and(isNull(studioExpenses.deletedAt)));

export const loadExpenseOccurrences = async (range: { from: Date; toExclusive: Date }): Promise<ExpenseOccurrence[]> =>
  expandExpenses(await loadExpenseRows(), kstDateString(range.from), kstDateString(range.toExclusive));

export interface ExpenseSummary {
  total: number;
  byCategory: Array<{ category: string; label: string; amount: number }>;
}

export const summarizeExpenses = (occurrences: readonly ExpenseOccurrence[], scope?: string): ExpenseSummary => {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const o of occurrences) {
    if (scope && o.scope !== scope) continue;
    total += o.amount;
    byCategory.set(o.category, (byCategory.get(o.category) ?? 0) + o.amount);
  }
  return {
    total,
    byCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, label: EXPENSE_CATEGORY_LABELS[category] ?? category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
};

export const createExpense = async (input: ExpenseInput, actor: string): Promise<string> => {
  const id = (await getDb().insert(studioExpenses).values({
    spentOn: input.spentOn,
    category: input.category as StudioExpense['category'],
    scope: input.scope as StudioExpense['scope'],
    description: input.description,
    amount: input.amount,
    repeatMonthly: input.repeatMonthly,
    repeatUntil: input.repeatUntil,
    memo: input.memo,
    createdBy: actor,
  }).returning({ id: studioExpenses.id }))[0].id;
  return id;
};

/** 소프트 삭제 — 누가 언제 지웠는지 남긴다. 이미 지웠거나 없으면 false. */
export const deleteExpense = async (id: string, actor: string, now: Date = new Date()): Promise<boolean> => {
  const result = await getDb().update(studioExpenses).set({ deletedAt: now, deletedBy: actor }).where(and(eq(studioExpenses.id, id), isNull(studioExpenses.deletedAt)));
  return Number(result.rowsAffected) > 0;
};

/** 반복 지출을 그 달까지로 끝낸다(`until`이 속한 달까지 센다). 반복이 아닌 행·없는 행은 false. */
export const endExpenseRepeat = async (id: string, until: string): Promise<boolean> => {
  if (!isRealDate(until)) return false;
  const result = await getDb().update(studioExpenses).set({ repeatUntil: until })
    .where(and(eq(studioExpenses.id, id), isNull(studioExpenses.deletedAt), eq(studioExpenses.repeatMonthly, true), gte(studioExpenses.spentOn, '2020-01-01')));
  return Number(result.rowsAffected) > 0;
};
