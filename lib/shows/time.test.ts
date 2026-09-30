import { salesCloseAt, isShowtimeLive, isSalesOpen } from './time';

describe('salesCloseAt', () => {
  it('회차 시작 전날 24:00(KST) = 당일 00:00(KST)를 반환한다', () => {
    // 2026-10-10 19:00 KST = 2026-10-10T10:00:00Z
    const startsAt = new Date('2026-10-10T10:00:00Z');
    const close = salesCloseAt(startsAt);
    // 전날 24:00 KST = 2026-10-10 00:00 KST = 2026-10-09T15:00:00Z
    expect(close.toISOString()).toBe('2026-10-09T15:00:00.000Z');
  });
});

describe('isSalesOpen', () => {
  it('마감 이전이면 true, 이후면 false', () => {
    const showtime = { salesCloseAt: Math.floor(new Date('2026-10-09T15:00:00Z').getTime() / 1000) };
    expect(isSalesOpen(showtime, new Date('2026-10-09T14:59:59Z'))).toBe(true);
    expect(isSalesOpen(showtime, new Date('2026-10-09T15:00:01Z'))).toBe(false);
  });
});

describe('isShowtimeLive', () => {
  it('scheduled이고 시작 전이면 live', () => {
    const showtime = { status: 'scheduled', startsAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(isShowtimeLive(showtime, new Date())).toBe(true);
  });
  it('cancelled면 live 아님', () => {
    const showtime = { status: 'cancelled', startsAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(isShowtimeLive(showtime, new Date())).toBe(false);
  });
  it('시작 시각이 지나면 live 아님', () => {
    const showtime = { status: 'scheduled', startsAt: Math.floor(Date.now() / 1000) - 1 };
    expect(isShowtimeLive(showtime, new Date())).toBe(false);
  });
});
