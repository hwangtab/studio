import { EXPENSE_SCOPE_LABELS, expandExpenses, isExpenseCheckViolation, loadExpenseOccurrences, parseExpenseInput, summarizeExpenses, type ExpenseOccurrence } from './expenses';
import { periodRange } from './revenueReport';

let mockRows: unknown[] = [];
jest.mock('../../db/client', () => ({ getDb: () => ({ select: () => ({ from: () => ({ where: async () => mockRows }) }) }) }));

const row = (over: Partial<Parameters<typeof expandExpenses>[0][number]> & { id: string; spentOn: string }) => ({
  category: 'rent', scope: 'practice', description: '임대료', amount: 1_000_000, repeatMonthly: false, repeatUntil: null as string | null, ...over,
});

describe('expandExpenses', () => {
  it('반복이 아니면 쓴 날 한 건만, 기간 밖이면 없다', () => {
    const rows = [row({ id: 'a', spentOn: '2026-10-05', amount: 50000, category: 'cleaning' })];
    expect(expandExpenses(rows, '2026-10-01', '2026-11-01').map((o) => [o.on, o.amount])).toEqual([['2026-10-05', 50000]]);
    expect(expandExpenses(rows, '2026-11-01', '2026-12-01')).toEqual([]);
  });

  it('매달 반복은 시작 달부터 기간 안의 달마다 한 건', () => {
    const rows = [row({ id: 'r', spentOn: '2026-08-15', repeatMonthly: true })];
    expect(expandExpenses(rows, '2026-10-01', '2027-01-01').map((o) => o.on)).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
    // 시작 달 이전은 세지 않는다.
    expect(expandExpenses(rows, '2026-01-01', '2026-09-01').map((o) => o.on)).toEqual(['2026-08-15']);
  });

  it('31일은 짧은 달의 말일로 보정하고 다음 달에 31일로 돌아온다', () => {
    const rows = [row({ id: 'r', spentOn: '2026-01-31', repeatMonthly: true })];
    expect(expandExpenses(rows, '2026-01-01', '2026-05-01').map((o) => o.on)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('반복 끝나는 날이 속한 달까지 센다', () => {
    const rows = [row({ id: 'r', spentOn: '2026-08-15', repeatMonthly: true, repeatUntil: '2026-10-02' })];
    expect(expandExpenses(rows, '2026-01-01', '2027-01-01').map((o) => o.on)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15']);
  });
});

describe('반복 지출은 오늘이 속한 달까지만 센다(월 입주 수입과 같은 규칙)', () => {
  // 2026-10-21 KST 낮 — 이번 달은 10월.
  const NOW = new Date('2026-10-21T03:00:00Z');
  const rent = row({ id: 'rent', spentOn: '2026-01-25', repeatMonthly: true, amount: 3_075_000, scope: 'studio' });
  beforeEach(() => { mockRows = [rent]; });

  it('연 전체(periodRange(년, all))는 1~10월만 — 11·12월 유령 지출이 없다', async () => {
    const occ = await loadExpenseOccurrences(periodRange(2026, 'all'), NOW);
    expect(occ.map((o) => o.on.slice(0, 7))).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  });

  it('앞으로 올 달(11월)은 지출이 없다', async () => {
    expect(await loadExpenseOccurrences(periodRange(2026, 11), NOW)).toEqual([]);
    expect(await loadExpenseOccurrences(periodRange(2027, 'all'), NOW)).toEqual([]);
  });

  it('이번 달은 날짜(25일)가 아직 안 왔어도 센다', async () => {
    expect((await loadExpenseOccurrences(periodRange(2026, 10), NOW)).map((o) => [o.on, o.amount])).toEqual([['2026-10-25', 3_075_000]]);
  });

  it('달이 바뀌면(11/1 KST 0시) 11월부터 센다', async () => {
    expect(await loadExpenseOccurrences(periodRange(2026, 11), new Date('2026-10-31T15:00:00Z'))).toHaveLength(1);
  });

  it('untilMonth를 주지 않으면(순수 함수 그대로) 창 끝까지 펼친다', () => {
    expect(expandExpenses([rent], '2026-11-01', '2027-01-01').map((o) => o.on)).toEqual(['2026-11-25', '2026-12-25']);
    expect(expandExpenses([rent], '2026-11-01', '2027-01-01', '2026-10')).toEqual([]);
  });
});

describe('summarizeExpenses', () => {
  it('구분별로 거르고 항목별 합계를 큰 순으로 낸다', () => {
    const occ: ExpenseOccurrence[] = [
      { expenseId: 'a', on: '2026-10-01', category: 'rent', scope: 'practice', description: '', amount: 1_000_000, repeat: true },
      { expenseId: 'b', on: '2026-10-05', category: 'cleaning', scope: 'practice', description: '', amount: 50_000, repeat: false },
      { expenseId: 'c', on: '2026-10-06', category: 'supplies', scope: 'studio', description: '', amount: 30_000, repeat: false },
    ];
    expect(summarizeExpenses(occ, 'practice')).toEqual({ total: 1_050_000, byCategory: [{ category: 'rent', label: '임대료', amount: 1_000_000 }, { category: 'cleaning', label: '청소비', amount: 50_000 }], nonOperatingTotal: 0 });
    expect(summarizeExpenses(occ).total).toBe(1_080_000);
  });

  it('대출 원금 상환은 손익 합계에서 빼고 따로 모은다', () => {
    const occ: ExpenseOccurrence[] = [
      { expenseId: 'a', on: '2026-10-01', category: 'rent', scope: 'studio', description: '', amount: 2_000_000, repeat: true },
      { expenseId: 'b', on: '2026-10-10', category: 'loan_principal', scope: 'studio', description: '', amount: 400_000, repeat: true },
      { expenseId: 'c', on: '2026-10-10', category: 'utilities', scope: 'recording', description: '', amount: 80_000, repeat: false },
    ];
    expect(summarizeExpenses(occ, 'studio')).toMatchObject({ total: 2_000_000, nonOperatingTotal: 400_000 });
    expect(summarizeExpenses(occ, 'studio').byCategory.map((c) => c.category)).toEqual(['rent']);
    expect(summarizeExpenses(occ, 'recording')).toMatchObject({ total: 80_000, nonOperatingTotal: 0 });
    expect(summarizeExpenses(occ)).toMatchObject({ total: 2_080_000, nonOperatingTotal: 400_000 });
  });
});

describe('isExpenseCheckViolation', () => {
  it('0084 전 CHECK 위반(메시지·원인 코드)을 알아본다', () => {
    expect(isExpenseCheckViolation(new Error('CHECK constraint failed: studio_expenses_scope_check'))).toBe(true);
    const wrapped = Object.assign(new Error('Failed query: insert ...'), { cause: Object.assign(new Error('x'), { code: 'SQLITE_CONSTRAINT_CHECK' }) });
    expect(isExpenseCheckViolation(wrapped)).toBe(true);
    expect(isExpenseCheckViolation(new Error('no such table: studio_expenses'))).toBe(false);
  });
});

describe('parseExpenseInput', () => {
  const ok = { spentOn: '2026-10-05', category: 'rent', scope: 'practice', description: '10월 임대료', amount: 1000000 };
  it('새 구분(녹음·제작·플랫폼·공통)과 대출 원금 항목을 받고, 모르는 구분은 거절한다', () => {
    for (const scope of ['practice', 'recording', 'platform', 'studio']) {
      expect(parseExpenseInput({ ...ok, scope }, '2026-10-21')).toMatchObject({ ok: true, value: { scope } });
    }
    expect(parseExpenseInput({ ...ok, category: 'loan_principal' }, '2026-10-21')).toMatchObject({ ok: true, value: { category: 'loan_principal' } });
    expect(parseExpenseInput({ ...ok, scope: 'common' }, '2026-10-21').ok).toBe(false);
    expect(parseExpenseInput({ ...ok, scope: 'other' }, '2026-10-21').ok).toBe(false);
    expect(EXPENSE_SCOPE_LABELS.studio).toMatch(/^공통/);
  });
  it('정상 입력을 받는다', () => {
    expect(parseExpenseInput(ok, '2026-10-21')).toMatchObject({ ok: true, value: { amount: 1000000, repeatMonthly: false, repeatUntil: null } });
    expect(parseExpenseInput({ ...ok, repeatMonthly: true, repeatUntil: '2027-03-31' }, '2026-10-21')).toMatchObject({ ok: true, value: { repeatMonthly: true, repeatUntil: '2027-03-31' } });
  });
  it('미래 날짜·없는 항목·0원·빈 내용·반복 끝이 시작보다 앞이면 거절한다', () => {
    expect(parseExpenseInput({ ...ok, spentOn: '2026-10-22' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseExpenseInput({ ...ok, category: 'x' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseExpenseInput({ ...ok, amount: 0 }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseExpenseInput({ ...ok, description: ' ' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseExpenseInput({ ...ok, repeatMonthly: true, repeatUntil: '2026-09-01' }, '2026-10-21')).toMatchObject({ ok: false });
  });
});

describe('parseExpenseInput — 프로토타입 키', () => {
  it('constructor·toString 같은 객체 속성 이름은 항목·구분으로 받지 않는다', () => {
    const base = { spentOn: '2026-10-01', category: 'rent', scope: 'practice', description: '임대료', amount: 1000 };
    expect(parseExpenseInput({ ...base, category: 'toString' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseExpenseInput({ ...base, scope: 'constructor' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseExpenseInput(base, '2026-10-21')).toMatchObject({ ok: true });
  });
});
