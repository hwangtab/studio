import { kstDateTime } from './kst';
import { rangesOverlap } from './overlap';

import { DEFAULT_CLOSE_HOUR, DEFAULT_OPEN_HOUR } from './products';

/** 스튜디오 영업시간. 상품별 범위는 products.ts의 productHours()가 정본이다. */
export const OPEN_HOUR = DEFAULT_OPEN_HOUR;
export const CLOSE_HOUR = DEFAULT_CLOSE_HOUR;

export interface DaySlot { startHour: number; available: boolean }

export const buildDaySlots = (input: {
  date: string;
  durationHours: number;
  busy: Array<{ start: Date; end: Date }>;
  now: Date;
  minLeadHours: number;
  /** 생략 시 스튜디오 영업시간. 연습실은 0~24. */
  openHour?: number;
  closeHour?: number;
}): DaySlot[] => {
  const openHour = input.openHour ?? OPEN_HOUR;
  const closeHour = input.closeHour ?? CLOSE_HOUR;
  const slots: DaySlot[] = [];
  for (let h = openHour; h + input.durationHours <= closeHour; h += 1) {
    const start = kstDateTime(input.date, h);
    const end = kstDateTime(input.date, h + input.durationHours);
    const leadOk = start.getTime() - input.now.getTime() >= input.minLeadHours * 3600 * 1000;
    const free = !input.busy.some((b) => rangesOverlap(start, end, b.start, b.end));
    slots.push({ startHour: h, available: leadOk && free });
  }
  return slots;
};

/**
 * 방 자원 상품용 — 방마다 따로 계산한 슬롯을 "하나라도 비면 가능"으로 합친다.
 * 모든 방의 슬롯 배열은 같은 시작 시각 목록을 가진다(같은 상품·같은 날짜).
 */
export const mergeRoomSlots = (perRoom: DaySlot[][]): DaySlot[] => {
  if (perRoom.length === 0) return [];
  return perRoom[0].map((slot, i) => ({
    startHour: slot.startHour,
    available: perRoom.some((room) => room[i]?.available === true),
  }));
};
