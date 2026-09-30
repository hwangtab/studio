/** 한국 공휴일(연도별). 영업일 계산에만 쓴다 — 법정공휴일 갱신은 매년 1회 수기. */
export const KR_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-03-01', '2026-05-05', '2026-05-24', '2026-06-06',
  '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-09', '2026-12-25',
];

export function isKrHoliday(date: Date): boolean {
  const y = date.getUTCFullYear();
  const list = y === 2026 ? KR_HOLIDAYS_2026 : [];
  const iso = date.toISOString().slice(0, 10);
  return list.includes(iso);
}
