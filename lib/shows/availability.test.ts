import { computeTicketTypeRemaining, showtimeSaleState } from './availability';

describe('computeTicketTypeRemaining', () => {
  const zones = [{ id: 'z1', capacity: 10 }, { id: 'z2', capacity: 5 }];

  it('구역 정원은 같은 구역의 티켓타입 사용분 합계로 센다', () => {
    const types = [
      { id: 'a', zoneId: 'z1', quota: null },
      { id: 'b', zoneId: 'z1', quota: null },
      { id: 'c', zoneId: 'z2', quota: null },
    ];
    expect(computeTicketTypeRemaining(zones, types, { a: 4, b: 3, c: 1 })).toEqual({ a: 3, b: 3, c: 4 });
  });

  it('티켓타입 한도가 구역 잔여보다 작으면 한도가 이긴다', () => {
    const types = [{ id: 'a', zoneId: 'z1', quota: 3 }];
    expect(computeTicketTypeRemaining(zones, types, { a: 2 })).toEqual({ a: 1 });
  });

  it('초과 판매 데이터가 있어도 음수로 내려가지 않는다', () => {
    const types = [{ id: 'a', zoneId: 'z2', quota: 2 }];
    expect(computeTicketTypeRemaining(zones, types, { a: 9 })).toEqual({ a: 0 });
  });

  it('사용분이 없으면 정원 그대로', () => {
    expect(computeTicketTypeRemaining(zones, [{ id: 'a', zoneId: 'z1', quota: null }], {})).toEqual({ a: 10 });
  });
});

describe('showtimeSaleState', () => {
  const base = { status: 'scheduled', startsAt: 2000, salesCloseAt: 1500 };
  it('취소·종료·마감·매진·판매중을 가른다', () => {
    expect(showtimeSaleState({ ...base, status: 'cancelled' }, 5, 1000)).toBe('cancelled');
    expect(showtimeSaleState({ ...base, status: 'ended' }, 5, 1000)).toBe('ended');
    expect(showtimeSaleState(base, 5, 2000)).toBe('ended');
    expect(showtimeSaleState(base, 5, 1500)).toBe('closed');
    expect(showtimeSaleState(base, 0, 1000)).toBe('sold_out');
    expect(showtimeSaleState(base, 1, 1000)).toBe('open');
  });
});
