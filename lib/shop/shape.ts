import { randomBytes } from 'crypto';

import { kstDateString } from '../booking/kst';

/**
 * 상점 주문번호 — `SHP-YYYYMMDD-XXXXXXXX`(KST 날짜 + 대문자 hex). 토스 orderId로 그대로 쓴다.
 *
 * 경로(`/ko/shop/manage/<주문번호>`)에 실리면 미들웨어가 소문자로 308한다 — 비교하는 쪽이 대문자로 정규화한다
 * (`normalizeShopOrderNo`, 공연 manage와 같다).
 */
export const generateShopOrderNo = (now: Date): string =>
  `SHP-${kstDateString(now).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

export const SHOP_ORDER_NO_PATTERN = /^SHP-\d{8}-[0-9A-F]{8}$/;

/** 경로·쿼리로 들어온 주문번호를 대문자로 맞추고 형식을 확인한다. 아니면 null. */
export const normalizeShopOrderNo = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return SHOP_ORDER_NO_PATTERN.test(upper) ? upper : null;
};
