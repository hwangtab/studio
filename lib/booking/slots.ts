import { kstDateTime } from './kst';
import { rangesOverlap } from './service';

export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 22;

export interface DaySlot { startHour: number; available: boolean }

export const buildDaySlots = (input: {
  date: string;
  durationHours: number;
  busy: Array<{ start: Date; end: Date }>;
  now: Date;
  minLeadHours: number;
}): DaySlot[] => {
  const slots: DaySlot[] = [];
  for (let h = OPEN_HOUR; h + input.durationHours <= CLOSE_HOUR; h += 1) {
    const start = kstDateTime(input.date, h);
    const end = kstDateTime(input.date, h + input.durationHours);
    const leadOk = start.getTime() - input.now.getTime() >= input.minLeadHours * 3600 * 1000;
    const free = !input.busy.some((b) => rangesOverlap(start, end, b.start, b.end));
    slots.push({ startHour: h, available: leadOk && free });
  }
  return slots;
};
