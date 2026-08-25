import { buildDaySlots, CLOSE_HOUR, OPEN_HOUR } from './slots';
import { kstDateTime } from './kst';

const noBusy: Array<{ start: Date; end: Date }> = [];
const past = new Date('2026-01-01T00:00:00Z');

describe('buildDaySlots', () => {
  it('빈 날은 영업시간 내 duration이 들어가는 시작 시각이 전부 가능', () => {
    const slots = buildDaySlots({ date: '2026-09-10', durationHours: 3, busy: noBusy, now: past, minLeadHours: 24 });
    expect(slots[0]).toEqual({ startHour: OPEN_HOUR, available: true });
    expect(slots[slots.length - 1].startHour).toBe(CLOSE_HOUR - 3);
    expect(slots.every((s) => s.available)).toBe(true);
  });
  it('바쁨 구간과 겹치는 시작 시각은 불가', () => {
    const busy = [{ start: kstDateTime('2026-09-10', 13), end: kstDateTime('2026-09-10', 15) }];
    const slots = buildDaySlots({ date: '2026-09-10', durationHours: 2, busy, now: past, minLeadHours: 24 });
    const at = (h: number) => slots.find((s) => s.startHour === h)!.available;
    expect(at(10)).toBe(true);   // 10–12, 접촉 아님
    expect(at(12)).toBe(false);  // 12–14 겹침
    expect(at(14)).toBe(false);  // 14–16 겹침
    expect(at(15)).toBe(true);   // 15–17
  });
  it('리드타임 이내 시작 시각은 불가', () => {
    const now = kstDateTime('2026-09-09', 20); // 다음 날 10~19시는 24h 이내
    const slots = buildDaySlots({ date: '2026-09-10', durationHours: 2, busy: noBusy, now, minLeadHours: 24 });
    expect(slots.find((s) => s.startHour === 10)!.available).toBe(false);
    expect(slots.find((s) => s.startHour === 20)!.available).toBe(true);
  });
});
