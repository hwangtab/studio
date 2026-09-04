import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { kstDateString } from './kst';

export const generateManageToken = (): string => randomBytes(24).toString('base64url');

/**
 * 토스 orderId 규격([A-Za-z0-9_-] 6~64자)에 맞는 사람이 읽을 수 있는 주문번호.
 *
 * 날짜는 KST로 자른다 — manage 페이지·확정/취소 이메일이 전부 KST로 시각을 보여주는데
 * (lib/booking/kst.ts) 여기만 UTC를 쓰면 00:00~09:00 KST 주문은 번호가 하루 전 날짜를
 * 문다("9월 4일 오전 8시 예약"이 SNB-20260903-…). 번호 자체는 뒤 랜덤 8자로 유일해
 * 기능엔 영향이 없지만, 정산·CS에서 주문번호만 다른 달력을 쓰게 된다.
 */
export const generateOrderNo = (now: Date): string => {
  const ymd = kstDateString(now).replace(/-/g, '');
  return `SNB-${ymd}-${randomBytes(4).toString('hex').toUpperCase()}`;
};

/** 길이 차이가 실행 시간에 드러나지 않게 SHA-256 고정 길이 후 비교 (lib/cron/auth.ts와 동일). */
export const isTokenMatch = (expected: string, given: string): boolean => {
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
};
