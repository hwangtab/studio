import { addMonthsOnBillingDay, daysBetween, flagsOf, overdueDays, parseTenancyInput } from './rules';

describe('addMonthsOnBillingDay', () => {
  it('납부일을 유지하고 말일은 보정한다', () => {
    expect(addMonthsOnBillingDay('2026-10-14', 1, 14)).toBe('2026-11-14');
    expect(addMonthsOnBillingDay('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(addMonthsOnBillingDay('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonthsOnBillingDay('2026-12-05', 1, 5)).toBe('2027-01-05');
  });
});

describe('flagsOf', () => {
  const base = { status: 'active', nextDueOn: '2026-11-01', endDate: null as string | null };
  it('연체·임박·계약 경과를 가른다', () => {
    expect(overdueDays('2026-10-10', '2026-10-16')).toBe(6);
    expect(flagsOf({ ...base, nextDueOn: '2026-10-10' }, '2026-10-16')).toEqual(['overdue']);
    expect(flagsOf({ ...base, nextDueOn: '2026-10-20' }, '2026-10-16')).toEqual(['due_soon']);
    expect(flagsOf({ ...base, endDate: '2026-04-25' }, '2026-10-16')).toEqual(['contract_passed']);
    expect(flagsOf({ ...base, endDate: '2026-10-31' }, '2026-10-16')).toEqual(['contract_soon']);
    expect(flagsOf({ ...base, status: 'ended', nextDueOn: '2020-01-01' }, '2026-10-16')).toEqual([]);
    expect(daysBetween('2026-10-16', '2026-10-31')).toBe(15);
  });
});

describe('parseTenancyInput', () => {
  const ok = { kind: 'room', roomNumber: 'r05', tenantName: ' 조현정 ', monthlyAmount: 360000, startDate: '2026-10-14', nextDueOn: '2026-11-14' };
  it('정상 입력을 정규화한다(납부일은 예정일에서)', () => {
    const r = parseTenancyInput(ok);
    expect(r.ok && r.value).toMatchObject({ roomNumber: 'R05', tenantName: '조현정', billingDay: 14, endDate: null });
  });
  it('비상주는 방 번호 없이, 방은 번호 필수', () => {
    expect(parseTenancyInput({ ...ok, kind: 'virtual', roomNumber: 'R01' })).toMatchObject({ ok: true, value: { roomNumber: null } });
    expect(parseTenancyInput({ ...ok, roomNumber: '' })).toMatchObject({ ok: false });
    expect(parseTenancyInput({ ...ok, startDate: '2026-02-30' })).toMatchObject({ ok: false });
    expect(parseTenancyInput({ ...ok, monthlyAmount: -1 })).toMatchObject({ ok: false });
  });
});
