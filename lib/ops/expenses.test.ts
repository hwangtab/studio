import { expandExpenses, parseExpenseInput, summarizeExpenses, type ExpenseOccurrence } from './expenses';

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

describe('summarizeExpenses', () => {
  it('구분별로 거르고 항목별 합계를 큰 순으로 낸다', () => {
    const occ: ExpenseOccurrence[] = [
      { expenseId: 'a', on: '2026-10-01', category: 'rent', scope: 'practice', description: '', amount: 1_000_000, repeat: true },
      { expenseId: 'b', on: '2026-10-05', category: 'cleaning', scope: 'practice', description: '', amount: 50_000, repeat: false },
      { expenseId: 'c', on: '2026-10-06', category: 'supplies', scope: 'studio', description: '', amount: 30_000, repeat: false },
    ];
    expect(summarizeExpenses(occ, 'practice')).toEqual({ total: 1_050_000, byCategory: [{ category: 'rent', label: '임대료', amount: 1_000_000 }, { category: 'cleaning', label: '청소비', amount: 50_000 }] });
    expect(summarizeExpenses(occ).total).toBe(1_080_000);
  });
});

describe('parseExpenseInput', () => {
  const ok = { spentOn: '2026-10-05', category: 'rent', scope: 'practice', description: '10월 임대료', amount: 1000000 };
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
