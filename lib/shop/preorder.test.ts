import { formatShipsOn, isPreorder, latestPendingShipsOn } from './preorder';

// KST 2026-10-20 00:00 = UTC 2026-10-19T15:00:00Z
describe('isPreorder (KST 날짜 기준)', () => {
  it('발송일이 오늘보다 뒤면 예약 판매, 오늘이면 아니다', () => {
    const justBeforeMidnight = new Date('2026-10-19T14:59:59Z'); // KST 10/19 23:59:59
    const midnight = new Date('2026-10-19T15:00:00Z'); // KST 10/20 00:00:00
    expect(isPreorder({ shipsOn: '2026-10-20' }, justBeforeMidnight)).toBe(true);
    expect(isPreorder({ shipsOn: '2026-10-20' }, midnight)).toBe(false);
    expect(isPreorder({ shipsOn: '2026-10-21' }, midnight)).toBe(true);
  });

  it('발송일이 없으면 예약 판매가 아니다', () => {
    expect(isPreorder({}, new Date())).toBe(false);
    expect(isPreorder({ shipsOn: null }, new Date())).toBe(false);
  });

  it('formatShipsOn · latestPendingShipsOn', () => {
    expect(formatShipsOn('2026-11-03')).toBe('2026년 11월 3일');
    const now = new Date('2026-10-19T15:00:00Z');
    expect(latestPendingShipsOn(['2026-10-20', '2026-11-03', '2026-10-25', null, undefined], now)).toBe('2026-11-03');
    expect(latestPendingShipsOn(['2026-10-20'], now)).toBeNull();
  });
});
