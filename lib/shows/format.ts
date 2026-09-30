const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatEntryNumber(n: number): string {
  return String(n).padStart(3, '0');
}

export function formatShowtimeLabel(startsAtSec: number): string {
  const kst = new Date(startsAtSec * 1000 + KST_OFFSET_MS);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const weekday = WEEKDAYS_KO[kst.getUTCDay()];
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mm}.${dd}(${weekday}) ${hh}:${min}`;
}
