const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatEntryNumber(n: number): string {
  return String(n).padStart(3, '0');
}

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 회차 표기(KST). ko `10.24(토) 18:30`, en `Sat, Oct 24, 18:30 KST` — 외국 방문자는 시간대가 다를 수 있어 KST를 붙인다. */
export function formatShowtimeLabel(startsAtSec: number, locale: 'ko' | 'en' = 'ko'): string {
  const kst = new Date(startsAtSec * 1000 + KST_OFFSET_MS);
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  if (locale === 'en') {
    return `${WEEKDAYS_EN[kst.getUTCDay()]}, ${MONTHS_EN[kst.getUTCMonth()]} ${kst.getUTCDate()}, ${hh}:${min} KST`;
  }
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const weekday = WEEKDAYS_KO[kst.getUTCDay()];
  return `${mm}.${dd}(${weekday}) ${hh}:${min}`;
}
