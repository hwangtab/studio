import { loadUnlinkedCalendarEvents } from './calendarImport';

const mockList = jest.fn();
const mockAll = jest.fn();
jest.mock('../booking/gcal', () => ({ listCalendarEvents: (...a: unknown[]) => mockList(...a) }));
jest.mock('../../db/client', () => ({ getDb: () => ({ all: (...a: unknown[]) => mockAll(...a) }) }));

const ev = (id: string, extra: Record<string, unknown> = {}) => ({
  id, summary: id, description: '', allDay: false, transparent: false,
  start: new Date('2026-10-20T02:00:00Z'), end: new Date('2026-10-20T05:00:00Z'), ...extra,
});

describe('loadUnlinkedCalendarEvents', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockAll.mockReset();
  });

  it('사이트가 올린 일정(id 연결·주문번호 줄)은 거르고 나머지만 돌려준다', async () => {
    mockList.mockResolvedValue([ev('a'), ev('b'), ev('c', { description: '주문번호: SNB-1' }), ev('d', { allDay: true })]);
    mockAll.mockResolvedValueOnce([{ id: 'a' }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { events, error } = await loadUnlinkedCalendarEvents(new Date(), new Date());
    expect(error).toBeNull();
    expect(events.map((e) => e.id)).toEqual(['b', 'd']);
    expect(events.find((e) => e.id === 'd')?.adoptable).toBe(false);
    expect(events.find((e) => e.id === 'b')?.adoptable).toBe(true);
  });

  it('"바쁨 아님"으로 표시한 일정은 예약이 아니므로 목록에 올리지 않는다', async () => {
    mockList.mockResolvedValue([ev('free', { transparent: true }), ev('busy')]);
    mockAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { events } = await loadUnlinkedCalendarEvents(new Date(), new Date());
    expect(events.map((e) => e.id)).toEqual(['busy']);
  });

  it('원본 일정을 못 지운 예약의 메모에 id가 있으면 그 일정은 다시 가져오지 않는다', async () => {
    mockList.mockResolvedValue([ev('stuck'), ev('fresh')]);
    mockAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ note: '[캘린더 자동 등록] x [원본 일정이 남아 있음: stuck]' }]);
    const { events } = await loadUnlinkedCalendarEvents(new Date(), new Date());
    expect(events.map((e) => e.id)).toEqual(['fresh']);
  });

  it('캘린더 실패는 던지지 않고 error를 돌려준다', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await loadUnlinkedCalendarEvents(new Date(), new Date());
    expect(result.events).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});
