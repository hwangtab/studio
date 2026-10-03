/**
 * 잔여석 계산(순수 함수). 재고 판정의 정본은 lib/shows/conditions.ts의 SQL 게이트이고,
 * 이 함수는 같은 기준을 화면용 숫자로 옮긴 것이다 — 구역 정원은 같은 구역을 쓰는 모든
 * 티켓타입의 사용분 합계로, 티켓타입 한도는 그 타입 하나의 사용분으로 센다.
 * 둘 중 작은 쪽이 그 티켓타입의 잔여석이다. 사용분은 호출부가 conditions.ts와 같은 집합
 * (issued·refunding + 만료되지 않은 held)으로 센다.
 *
 * 화면 숫자는 안내용이다 — 실제 판매 가능 여부는 createShowOrder의 원자적 게이트가 정한다.
 */
export interface ZoneInput {
  id: string;
  capacity: number;
}

export interface TicketTypeInput {
  id: string;
  zoneId: string;
  /** null이면 티켓타입 한도 없음(구역 정원만 적용). */
  quota: number | null;
}

/** ticketTypeId → 이 회차에서 이미 쓰인 수(issued·refunding·유효한 held). */
export type UsedByTicketType = Record<string, number>;

export function computeTicketTypeRemaining(
  zones: ZoneInput[],
  ticketTypes: TicketTypeInput[],
  used: UsedByTicketType
): Record<string, number> {
  const zoneUsed: Record<string, number> = {};
  for (const tt of ticketTypes) {
    zoneUsed[tt.zoneId] = (zoneUsed[tt.zoneId] ?? 0) + (used[tt.id] ?? 0);
  }
  const capacityByZone = new Map(zones.map((z) => [z.id, z.capacity]));
  const out: Record<string, number> = {};
  for (const tt of ticketTypes) {
    const zoneLeft = (capacityByZone.get(tt.zoneId) ?? 0) - (zoneUsed[tt.zoneId] ?? 0);
    const quotaLeft = tt.quota == null ? Number.POSITIVE_INFINITY : tt.quota - (used[tt.id] ?? 0);
    out[tt.id] = Math.max(0, Math.min(zoneLeft, quotaLeft));
  }
  return out;
}

export type ShowtimeSaleState = 'open' | 'sold_out' | 'closed' | 'ended' | 'cancelled';

/** 회차 판매 상태 — 판매창 게이트(scheduled + sales_close_at > now)와 같은 기준. */
export function showtimeSaleState(
  showtime: { status: string; startsAt: number; salesCloseAt: number },
  remainingTotal: number,
  nowSec: number
): ShowtimeSaleState {
  if (showtime.status === 'cancelled') return 'cancelled';
  if (showtime.status === 'ended' || showtime.startsAt <= nowSec) return 'ended';
  if (showtime.salesCloseAt <= nowSec) return 'closed';
  if (remainingTotal <= 0) return 'sold_out';
  return 'open';
}
