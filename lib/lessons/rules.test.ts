import { addDays, arrearsOf, kstMoment, overlaps, parseEnrollmentInput, parsePaymentInput, progressOf, sessionDates, slotRange, weekdayOf } from './rules';

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

describe('arrearsOf — 휴강 보충 회차', () => {
  it('보충 회차가 붙어도 과정 개월 수를 넘는 달은 받지 않는다', () => {
    const sessions = Array.from({ length: 13 }, (_, i) => ({ status: i < 12 ? 'done' : 'scheduled', scheduledOn: `2026-0${1 + Math.floor(i / 4)}-${String(1 + (i % 4) * 7).padStart(2, '0')}` }));
    const base = { payMethod: 'bank', monthlyAmount: 350000, sessions, payments: [{ amount: 1050000, vatAmount: 0 }], today: '2026-12-31' };
    expect(arrearsOf({ ...base, courseMonths: 3 })).toMatchObject({ monthsDue: 3, arrears: 0 });
    expect(arrearsOf(base).monthsDue).toBe(4); // courseMonths를 안 주면 예전 계산(회차 수로 센다)
  });
});

describe('arrearsOf — 계좌·현금 선불 미수금', () => {
  const weekly = (start: string, n: number, doneUpTo: string) => sessionDates(start, n).map((on) => ({ scheduledOn: on, status: on <= doneUpTo ? 'done' : 'scheduled' }));
  const base = { payMethod: 'bank', monthlyAmount: 350000, today: '2026-10-21' };

  it('시작 전 3일 안이면 한 달 치를 받았어야 하고, 더 먼저는 아직이다', () => {
    expect(arrearsOf({ ...base, sessions: weekly('2026-10-23', 12, ''), payments: [] })).toMatchObject({ monthsDue: 1, arrears: 350000 });
    expect(arrearsOf({ ...base, sessions: weekly('2026-11-10', 12, ''), payments: [] })).toMatchObject({ monthsDue: 0, arrears: 0 });
  });

  it('진행한 회차 4개마다 한 달 치 — 5번째 수업이 되면 두 달째', () => {
    const four = weekly('2026-09-30', 12, '2026-10-21'); // 9/30·10/7·10/14·10/21 → 4회 진행
    expect(arrearsOf({ ...base, sessions: four, payments: [{ amount: 350000, vatAmount: 0 }] }).arrears).toBe(0);
    const five = weekly('2026-09-23', 12, '2026-10-21'); // 5회 진행
    expect(arrearsOf({ ...base, sessions: five, payments: [{ amount: 350000, vatAmount: 0 }] })).toMatchObject({ monthsDue: 2, arrears: 350000 });
  });

  it('과정 일괄 선불은 몇 달 치를 덮고, 부가세는 받은 돈에서 뺀다', () => {
    const sessions = weekly('2026-09-02', 12, '2026-10-21'); // 8회 진행 → 2개월
    expect(arrearsOf({ ...base, sessions, payments: [{ amount: 1050000, vatAmount: 0 }] }).arrears).toBe(0);
    expect(arrearsOf({ ...base, sessions, payments: [{ amount: 385000, vatAmount: 35000 }] })).toMatchObject({ paidNet: 350000, arrears: 350000 });
  });

  it('카드는 구독이 청구하므로 0, 결석·진행 회차는 세고 휴강·취소는 세지 않는다', () => {
    expect(arrearsOf({ ...base, payMethod: 'card', sessions: weekly('2026-09-02', 12, '2026-10-21'), payments: [] }).arrears).toBe(0);
    const sessions = [
      { scheduledOn: '2026-10-07', status: 'absent' }, { scheduledOn: '2026-10-14', status: 'studio_cancelled' }, { scheduledOn: '2026-10-21', status: 'dropped' }, { scheduledOn: '2026-10-28', status: 'scheduled' },
    ];
    expect(arrearsOf({ ...base, sessions, payments: [] })).toMatchObject({ monthsDue: 1 }); // 결석 1회만 시작된 회차
  });
});
