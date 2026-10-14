import { kstDateString } from '../booking/kst';

/**
 * 예약 판매 판정 — 순수 모듈(클라이언트도 쓴다). `ships_on`(YYYY-MM-DD, KST)이 오늘(KST)보다 뒤면 예약 판매다.
 * 발송일 당일부터는 보통 상품이다 — 같은 날 보낼 수 있다. 날짜는 주문에 스냅샷하지 않고 상품의 현재 값을 읽는다.
 */

export const isPreorder = (product: { shipsOn?: string | null }, now: Date): boolean =>
  isPendingShipsOn(product.shipsOn, now);

export const isPendingShipsOn = (shipsOn: string | null | undefined, now: Date): boolean =>
  typeof shipsOn === 'string' && shipsOn > kstDateString(now);

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일'. 형식이 아니면 그대로. */
export const formatShipsOn = (shipsOn: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(shipsOn);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : shipsOn;
};

/** 아직 오지 않은 발송일 가운데 가장 늦은 날. 없으면 null. */
export const latestPendingShipsOn = (dates: Iterable<string | null | undefined>, now: Date): string | null => {
  let latest: string | null = null;
  for (const d of dates) {
    if (isPendingShipsOn(d, now) && (latest === null || (d as string) > latest)) latest = d as string;
  }
  return latest;
};
