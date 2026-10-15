import { loadUnlinkedCalendarEvents } from './calendarImport';

const mockList = jest.fn();
const mockAll = jest.fn();
jest.mock('../booking/gcal', () => ({ listCalendarEvents: (...a: unknown[]) => mockList(...a) }));
jest.mock('../../db/client', () => ({ getDb: () => ({ all: (...a: unknown[]) => mockAll(...a) }) }));

const ev = (id: string, extra: Record<string, unknown> = {}) => ({
  id, summary: id, description: '', allDay: false,
  start: new Date('2026-10-20T02:00:00Z'), end: new Date('2026-10-20T05:00:00Z'), ...extra,
});

describe('loadUnlinkedCalendarEvents', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockAll.mockReset();
  });

  it('사이트가 올린 일정(id 연결·주문번호 줄)은 거르고 나머지만 돌려준다', async () => {
    mockList.mockResolvedValue([ev('a'), ev('b'), ev('c', { description: '주문번호: SNB-1' }), ev('d', { allDay: true })]);
    mockAll.mockResolvedValueOnce([{ id: 'a' }]).mockResolvedValueOnce([]);
    const { events, error } = await loadUnlinkedCalendarEvents(new Date(), new Date());
    expect(error).toBeNull();
    expect(events.map((e) => e.id)).toEqual(['b', 'd']);
    expect(events.find((e) => e.id === 'd')?.adoptable).toBe(false);
    expect(events.find((e) => e.id === 'b')?.adoptable).toBe(true);
  });

  it('캘린더 실패는 던지지 않고 error를 돌려준다', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await loadUnlinkedCalendarEvents(new Date(), new Date());
    expect(result.events).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});
