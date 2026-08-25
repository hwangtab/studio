import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const generateManageToken = (): string => randomBytes(24).toString('base64url');

/** 토스 orderId 규격([A-Za-z0-9_-] 6~64자)에 맞는 사람이 읽을 수 있는 주문번호. */
export const generateOrderNo = (now: Date): string => {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `SNB-${ymd}-${randomBytes(4).toString('hex').toUpperCase()}`;
};

/** 길이 차이가 실행 시간에 드러나지 않게 SHA-256 고정 길이 후 비교 (lib/cron/auth.ts와 동일). */
export const isTokenMatch = (expected: string, given: string): boolean => {
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
};
