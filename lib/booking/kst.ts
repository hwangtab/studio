/** 한국은 DST가 없어 고정 오프셋으로 충분하다. Intl 왕복보다 단순하고 서버·클라 동일 결과. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const kstDateString = (d: Date): string =>
  new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

/** 'YYYY-MM-DD' + KST 시(hour) → 그 벽시계 시각의 UTC Date. */
export const kstDateTime = (dateStr: string, hour: number): Date =>
  new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + (hour * 60 * 60 * 1000) - KST_OFFSET_MS);

const kstEpochDay = (d: Date): number =>
  Math.floor((d.getTime() + KST_OFFSET_MS) / (24 * 60 * 60 * 1000));

/** target이 now보다 KST 달력으로 며칠 뒤인지. 같은 날 0, 지난 날 음수. */
export const daysUntilKst = (now: Date, target: Date): number =>
  kstEpochDay(target) - kstEpochDay(now);
