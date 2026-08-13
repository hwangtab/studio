/** @jest-environment node */

/**
 * 이 테스트는 서버(UTC)와 브라우저(KST)가 같은 값을 말하는지 확인한다.
 *
 * 시간대를 지정하지 않던 때에는 밤 12시 30분 서명이 PDF에는 "전날 오후 3시 30분"으로,
 * 관리자 화면에는 "당일 오전 12시 30분"으로 찍혔다. 서명 시각은 이 문서가 증명하려는 것의
 * 핵심이라, 두 곳이 다른 날짜를 말하면 문의가 왔을 때 설명할 수가 없다.
 */

import {
  formatCompactDate,
  formatDate,
  formatDateTime,
  formatShortDate,
} from './format';

/** 2026-08-26 00:30 KST = 2026-08-25 15:30 UTC — 날짜가 갈리는 시각 */
const LATE_NIGHT_SIGNATURE = new Date('2026-08-25T15:30:00.000Z');

describe('계약 날짜 표기', () => {
  it('심야 서명을 한국 날짜로 적는다 (UTC로 읽으면 전날이 된다)', () => {
    expect(formatDate(LATE_NIGHT_SIGNATURE)).toBe('2026년 8월 26일');
    expect(formatDateTime(LATE_NIGHT_SIGNATURE)).toContain('2026년 8월 26일');
    expect(formatCompactDate(LATE_NIGHT_SIGNATURE)).toBe('2026.08.26');
  });

  it('오후 서명의 시각이 9시간 어긋나지 않는다', () => {
    // 2026-08-11 16:30 KST = 07:30 UTC
    const afternoon = new Date('2026-08-11T07:30:00.000Z');
    const text = formatDateTime(afternoon);

    expect(text).toContain('2026년 8월 11일');
    expect(text).toContain('04:30'); // 오후 04:30
    expect(text).toContain('오후');
  });

  /**
   * 이 테스트가 이 파일의 존재 이유다. 프로세스 시간대를 바꿔도 결과가 같아야
   * 서버와 브라우저가 같은 말을 한다.
   */
  it.each(['UTC', 'Asia/Seoul', 'America/New_York'])(
    'TZ=%s 에서도 같은 값을 낸다',
    (tz) => {
      const original = process.env.TZ;
      try {
        process.env.TZ = tz;
        expect(formatDate(LATE_NIGHT_SIGNATURE)).toBe('2026년 8월 26일');
        expect(formatCompactDate(LATE_NIGHT_SIGNATURE)).toBe('2026.08.26');
        expect(formatDateTime(LATE_NIGHT_SIGNATURE)).toContain('오전 12:30');
      } finally {
        process.env.TZ = original;
      }
    },
  );

  it('계약 기간(UTC 자정 저장)은 같은 날로 읽힌다', () => {
    // 폼에서 '2026-09-01'을 넣으면 new Date()가 UTC 자정으로 파싱한다.
    const startDate = new Date('2026-09-01');

    expect(formatDate(startDate)).toBe('2026년 9월 1일');
    expect(formatCompactDate(startDate)).toBe('2026.09.01');
  });

  it('값이 없으면 대체 문자를 낸다', () => {
    for (const fn of [formatDate, formatShortDate, formatCompactDate, formatDateTime]) {
      expect(fn(null)).toBe('-');
      expect(fn(undefined)).toBe('-');
      expect(fn('')).toBe('-');
    }
  });

  it('깨진 날짜 문자열에도 예외를 던지지 않는다', () => {
    expect(formatDate('그런 날짜 없음')).toBe('-');
    expect(formatDateTime('2026-13-45')).toBe('-');
  });

  it('ISO 문자열과 Date 객체가 같은 결과를 낸다', () => {
    expect(formatDateTime(LATE_NIGHT_SIGNATURE.toISOString())).toBe(
      formatDateTime(LATE_NIGHT_SIGNATURE),
    );
  });
});
