import { refundRateForNotice, calcRefundAmount, refundTierLines } from './refundPolicy';

describe('refundRateForNotice', () => {
  const showtime = new Date('2026-10-10T10:00:00Z'); // 19:00 KST

  it('4일 전 취소는 80%', () => {
    const notice = new Date('2026-10-06T10:00:00Z');
    expect(refundRateForNotice(showtime, notice)).toBe(80);
  });

  it('10일 이전은 100%', () => {
    const notice = new Date('2026-09-29T10:00:00Z'); // 11일 전
    expect(refundRateForNotice(showtime, notice)).toBe(100);
  });

  it('9~7일 전은 90%', () => {
    const notice = new Date('2026-10-02T10:00:00Z'); // 8일 전
    expect(refundRateForNotice(showtime, notice)).toBe(90);
  });

  it('6~3일 전은 80%', () => {
    const notice = new Date('2026-10-05T10:00:00Z'); // 5일 전
    expect(refundRateForNotice(showtime, notice)).toBe(80);
  });

  it('2~1일 전은 70%', () => {
    const notice = new Date('2026-10-09T10:00:00Z'); // 1일 전
    expect(refundRateForNotice(showtime, notice)).toBe(70);
  });

  it('공연 당일(시작 전)은 10%', () => {
    const notice = new Date('2026-10-10T09:00:00Z'); // 시작 1시간 전
    expect(refundRateForNotice(showtime, notice)).toBe(10);
  });

  // 달력(KST) 기준 — 표·FAQ·메일이 약속한 '공연 N일 전'과 같은 셈법이어야 한다.
  it('전날 저녁(20:00 KST) 취소는 23시간 전이어도 1일 전 — 70%', () => {
    const notice = new Date('2026-10-09T11:00:00Z'); // 전날 20:00 KST
    expect(refundRateForNotice(showtime, notice)).toBe(70);
  });

  it('당일 새벽(00:30 KST) 취소는 당일 — 10%', () => {
    const notice = new Date('2026-10-09T15:30:00Z'); // 당일 00:30 KST
    expect(refundRateForNotice(showtime, notice)).toBe(10);
  });

  it('10일 전 밤 23:00 KST 취소는 10일 전 — 100%', () => {
    const notice = new Date('2026-09-30T14:00:00Z'); // 9/30 23:00 KST
    expect(refundRateForNotice(showtime, notice)).toBe(100);
  });

  it('KST 자정을 넘기면 하루가 줄어든다 — 3일 전 23:59는 80%, 2일 전 00:00은 70%', () => {
    expect(refundRateForNotice(showtime, new Date('2026-10-07T14:59:00Z'))).toBe(80); // 10/7 23:59 KST
    expect(refundRateForNotice(showtime, new Date('2026-10-07T15:00:00Z'))).toBe(70); // 10/8 00:00 KST
  });

  it('시작 이후는 0%(환불 불가)', () => {
    const notice = new Date('2026-10-10T11:00:00Z');
    expect(refundRateForNotice(showtime, notice)).toBe(0);
  });
});

describe('calcRefundAmount', () => {
  it('정수 % 절사 — 22,000원 70%는 15,400원', () => {
    expect(calcRefundAmount(22000, 70)).toBe(15400);
  });
});

describe('refundTierLines', () => {
  it('취소환불표 5구간을 계산 표와 같은 순서·비율로 문장으로 만든다', () => {
    expect(refundTierLines()).toEqual([
      '공연 10일 전까지 — 100%',
      '공연 7~9일 전 — 90%',
      '공연 3~6일 전 — 80%',
      '공연 1~2일 전 — 70%',
      '공연 당일(시작 전) — 10%',
    ]);
  });
});

test('영어 환불표는 한국어 표와 같은 줄 수·같은 비율이다', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { refundTierLines, refundTierLinesEn, REFUND_POLICY_FOOTNOTES, REFUND_POLICY_FOOTNOTES_EN } = require('./refundPolicy');
  const pct = (lines: string[]) => lines.map((l) => l.split('— ')[1]);
  expect(pct(refundTierLinesEn())).toEqual(pct(refundTierLines()));
  expect(refundTierLinesEn()[0]).toBe('Up to 10 days before the show — 100%');
  expect(REFUND_POLICY_FOOTNOTES_EN).toHaveLength(REFUND_POLICY_FOOTNOTES.length);
});
