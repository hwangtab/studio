import { addDays, kstMoment, overlaps, parseEnrollmentInput, parsePaymentInput, progressOf, sessionDates, slotRange, weekdayOf } from './rules';

describe('회차 날짜·시각', () => {
  it('첫 수업일부터 매주 같은 요일로 과정 길이만큼', () => {
    const dates = sessionDates('2026-10-21', 12);
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe('2026-10-21');
    expect(dates[11]).toBe('2027-01-06');
    expect(new Set(dates.map(weekdayOf)).size).toBe(1);
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('KST 시각을 UTC로 바꾸고 겹침을 가린다', () => {
    expect(kstMoment('2026-10-21', '14:00').toISOString()).toBe('2026-10-21T05:00:00.000Z');
    const a = slotRange('2026-10-21', '14:00', 60);
    expect(overlaps(a, slotRange('2026-10-21', '14:30', 60))).toBe(true);
    expect(overlaps(a, slotRange('2026-10-21', '15:00', 60))).toBe(false); // 끝과 시작이 맞닿는 것은 겹침이 아니다
  });
});

describe('parseEnrollmentInput', () => {
  const ok = { studentName: ' 김수강 ', payMethod: 'bank', courseWeeks: 12, startDate: '2026-10-28', startTime: '14:00' };
  it('기본값(60분·35만원)을 채우고 이름을 다듬는다', () => {
    expect(parseEnrollmentInput(ok, '2026-10-21')).toMatchObject({ ok: true, value: { studentName: '김수강', durationMin: 60, monthlyAmount: 350000, courseWeeks: 12 } });
  });
  it('이름 없음·잘못된 과정·결제 방식·날짜·시각·금액을 거절한다', () => {
    expect(parseEnrollmentInput({ ...ok, studentName: ' ' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseEnrollmentInput({ ...ok, courseWeeks: 16 }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseEnrollmentInput({ ...ok, payMethod: 'x' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseEnrollmentInput({ ...ok, startDate: '2026-13-01' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseEnrollmentInput({ ...ok, startTime: '25:00' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parseEnrollmentInput({ ...ok, monthlyAmount: 350 }, '2026-10-21')).toMatchObject({ ok: false });
  });
});

describe('parsePaymentInput', () => {
  const ok = { paidOn: '2026-10-20', amount: 350000, periodLabel: '10월', method: '계좌 입금' };
  it('부가세 안 받은 현금·계좌 수납(부가세 0)을 받는다', () => {
    expect(parsePaymentInput(ok, '2026-10-21')).toMatchObject({ ok: true, value: { amount: 350000, vatAmount: 0, receiptIssued: false } });
  });
  it('미래 날짜·부가세가 금액 이상·기간 없음·모르는 방법을 거절한다', () => {
    expect(parsePaymentInput({ ...ok, paidOn: '2026-10-22' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parsePaymentInput({ ...ok, vatAmount: 350000 }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parsePaymentInput({ ...ok, periodLabel: '' }, '2026-10-21')).toMatchObject({ ok: false });
    expect(parsePaymentInput({ ...ok, method: '카드' }, '2026-10-21')).toMatchObject({ ok: false });
  });
});

describe('progressOf', () => {
  it('결석은 소화된 회차로 세고 휴강·중도 종료 취소는 세지 않는다', () => {
    expect(progressOf([{ status: 'done' }, { status: 'absent' }, { status: 'scheduled' }, { status: 'studio_cancelled' }, { status: 'dropped' }]))
      .toEqual({ total: 3, consumed: 2, done: 1, absent: 1, scheduled: 1 });
  });
});
