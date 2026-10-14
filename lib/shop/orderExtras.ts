import { orderHasDigitalLines } from './downloads';
import { latestPendingShipsOn, isPendingShipsOn } from './preorder';
import { loadShipsOnBySku } from './repository';
import { formatSerials, loadOrderSerials } from './serials';

/**
 * 주문 화면·메일에 덧붙이는 두 가지 — 예약 발송일(상품의 현재 값, 주문에 스냅샷하지 않는다)과 한정판 번호.
 * 둘 다 오류를 삼킨다(없는 것처럼 보일 뿐 — 주문 화면·메일이 이것 때문에 깨지면 안 된다).
 */

export interface OrderExtras {
  /** 줄 id → 아직 오지 않은 발송일. 예약 줄만. */
  shipsOnByItem: Map<string, string>;
  /** 가장 늦은 발송 예정일. 예약 줄이 없으면 null. */
  latestShipsOn: string | null;
  /** 줄 id → "7/100, 8/100". 번호가 있는 줄만. */
  serialsByItem: Map<string, string>;
  /** 디지털 상품 줄이 있는가(디지털만이든 섞였든). 조회 실패는 false. */
  hasDigital: boolean;
}

export const loadOrderExtras = async (
  orderNo: string,
  items: ReadonlyArray<{ id: string; skuId: string }>,
  now: Date,
): Promise<OrderExtras> => {
  const bySku = await loadShipsOnBySku(items.map((i) => i.skuId));
  const shipsOnByItem = new Map<string, string>();
  for (const i of items) {
    const d = bySku.get(i.skuId);
    if (d && isPendingShipsOn(d, now)) shipsOnByItem.set(i.id, d);
  }
  const serials = await loadOrderSerials(orderNo, items);
  const serialsByItem = new Map<string, string>();
  for (const [itemId, list] of serials) {
    const label = formatSerials(list);
    if (label) serialsByItem.set(itemId, label);
  }
  const hasDigital = await orderHasDigitalLines(orderNo, items).catch(() => false);
  return { shipsOnByItem, latestShipsOn: latestPendingShipsOn(shipsOnByItem.values(), now), serialsByItem, hasDigital };
};
