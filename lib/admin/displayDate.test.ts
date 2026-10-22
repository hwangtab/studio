import { formatAdminDate, formatAdminDateFromSeconds, formatAdminDateTime, formatAdminDateTimeFromSeconds } from './displayDate';

describe('관리자 날짜 표시 정본', () => {
  it('순간(ISO·Date·ms)은 KST로 `YYYY.MM.DD (요일) HH:mm`', () => {
    expect(formatAdminDateTime('2026-10-21T15:01:00.000Z')).toBe('2026.10.22 (목) 00:01');
    expect(formatAdminDateTime(new Date('2026-10-22T03:30:00.000Z'))).toBe('2026.10.22 (목) 12:30');
    expect(formatAdminDateTime(Date.UTC(2026, 9, 21, 15, 1))).toBe('2026.10.22 (목) 00:01');
  });
  it('날짜만 쓰는 자리는 `YYYY.MM.DD (요일)`', () => {
    expect(formatAdminDate('2026-10-21T15:01:00.000Z')).toBe('2026.10.22 (목)');
  });
  it('`YYYY-MM-DD`는 시간대 변환 없이 그 날짜 그대로(시각 없음)', () => {
    expect(formatAdminDate('2026-10-01')).toBe('2026.10.01 (목)');
    expect(formatAdminDateTime('2026-10-01')).toBe('2026.10.01 (목)');
  });
  it('epoch 초', () => {
    expect(formatAdminDateTimeFromSeconds(Date.UTC(2026, 9, 21, 15, 1) / 1000)).toBe('2026.10.22 (목) 00:01');
    expect(formatAdminDateFromSeconds(null)).toBe('-');
  });
  it('빈 값·잘못된 값은 fallback', () => {
    expect(formatAdminDateTime(null)).toBe('-');
    expect(formatAdminDateTime('')).toBe('-');
    expect(formatAdminDateTime('not a date', '없음')).toBe('없음');
  });
});
