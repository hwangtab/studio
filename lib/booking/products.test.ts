import { splitInclusiveAmount } from './amounts';
import {
  DEFAULT_CLOSE_HOUR, DEFAULT_OPEN_HOUR, PRACTICE_ROOM_HOURLY_ROOMS,
  getProduct, productHours, productsForService, resourceKindOf,
} from './products';
import { PRACTICE_ROOM_HOURLY_PRICE_INCL } from '../../data/pricing';

/**
 * 연습실 시간제는 다른 세션 상품과 세 가지가 다르다 — 24시간, 방 자원, VAT 포함 소비자가.
 * 셋 중 하나라도 기본값으로 돌아가면 새벽 예약이 막히거나, 연습실이 녹음을 막거나,
 * 4,400원이 4,840원으로 청구된다. 여기서 고정한다.
 */
describe('practice-room-hourly', () => {
  const p = getProduct('practice-room-hourly')!;

  it('서비스 practice-room에 시간제 상품 하나가 있다', () => {
    expect(productsForService('practice-room').map((x) => x.id)).toEqual(['practice-room-hourly']);
    expect(p.kind).toBe('hourly');
    expect(p.minHours).toBe(1);
  });

  it('24시간 — 0시 시작도, 23시 시작 1시간도 가능', () => {
    expect(productHours(p)).toEqual({ openHour: 0, closeHour: 24 });
  });

  it('방 자원이고 후보 방은 R02 하나(R05는 나중에)', () => {
    expect(resourceKindOf(p)).toBe('rooms');
    expect([...(p.rooms ?? [])]).toEqual([...PRACTICE_ROOM_HOURLY_ROOMS]);
    expect(PRACTICE_ROOM_HOURLY_ROOMS).toEqual(['R02']);
  });

  it('소비자가 4,400원(VAT 포함)이 공급가 4,000 + VAT 400으로 갈린다', () => {
    expect(PRACTICE_ROOM_HOURLY_PRICE_INCL).toBe(4400);
    expect(p.unitAmount).toBe(4000);
    expect(splitInclusiveAmount(PRACTICE_ROOM_HOURLY_PRICE_INCL)).toEqual({ itemAmount: 4000, vatAmount: 400, totalAmount: 4400 });
  });
});

describe('기존 세션 상품은 스튜디오 자원·영업시간 그대로', () => {
  it.each(['recording-pro', 'recording-hourly', 'recording-daylock-4h', 'recording-daylock-8h', 'voice-acting-hourly', 'wedding-song', 'cover-video'])('%s', (id) => {
    const p = getProduct(id)!;
    expect(resourceKindOf(p)).toBe('studio');
    expect(productHours(p)).toEqual({ openHour: DEFAULT_OPEN_HOUR, closeHour: DEFAULT_CLOSE_HOUR });
  });
});
