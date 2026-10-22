/**
 * 관리자 화면의 날짜·시각 **표시** 정본 — `2026.10.22 (목) 00:01`, 날짜만이면 `2026.10.22 (목)`. 항상 KST.
 *
 * 예전엔 화면마다 달랐다(2026-10-22 운영자 결정으로 통일): 예약은 `2026.10.22 (목) 00:01`(lib/booking/format.ts),
 * 계약은 `2026년 10월 22일 오전 12:02`(lib/contracts/format.ts), 상점·결제 링크는 `10. 22. 오전 12:02`, 입주·지출은
 * `2026-10-22`. 같은 순간이 화면을 옮길 때마다 다르게 읽혔다.
 *
 * **표시 전용이다.** 날짜 입력칸의 값, API로 보내는 값, CSV·메일·계약서 PDF에는 쓰지 않는다 — 그쪽은 각자의 형식이
 * 계약(파일 형식·법적 문서)이다. lib/contracts/format.ts는 계약서·메일이 쓰므로 그대로 둔다.
 *
 * 받는 값:
 * - ISO 문자열·Date·epoch 밀리초(number) → 그 순간을 KST로.
 * - `YYYY-MM-DD`(KST 달력 날짜로 저장한 값 — 입주 예정일·지출일·레슨 회차) → 시간대 변환 없이 그 날짜 그대로.
 *   UTC 자정으로 읽으면 요일은 맞지만, 다른 시간대 런타임에서 하루 밀릴 수 있어 문자열을 직접 쪼갠다.
 * 값이 없거나 읽을 수 없으면 `fallback`(기본 `-`).
 *
 * 한국은 서머타임이 없어 +9시간 고정 오프셋으로 계산한다(lib/booking/format.ts와 같은 방식) — Intl 로케일 데이터에
 * 기대지 않으므로 서버(Vercel)·브라우저 어디서 렌더해도 한 글자도 다르지 않다(하이드레이션 불일치 없음).
 */
export type AdminDateValue = string | number | Date | null | undefined;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, '0');

interface Parts {
  y: number;
  m: number;
  d: number;
  weekday: number;
  hh: number | null;
  mm: number | null;
}

const partsOf = (value: AdminDateValue): Parts | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const dateOnly = DATE_ONLY.exec(value.trim());
    if (dateOnly) {
      const [y, m, d] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (Number.isNaN(weekday)) return null;
      return { y, m, d, weekday, hh: null, mm: null };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return null;
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  return { y: kst.getUTCFullYear(), m: kst.getUTCMonth() + 1, d: kst.getUTCDate(), weekday: kst.getUTCDay(), hh: kst.getUTCHours(), mm: kst.getUTCMinutes() };
};

/** `2026.10.22 (목)` */
export const formatAdminDate = (value: AdminDateValue, fallback = '-'): string => {
  const p = partsOf(value);
  if (!p) return fallback;
  return `${p.y}.${pad(p.m)}.${pad(p.d)} (${WEEKDAYS[p.weekday]})`;
};

/** `2026.10.22 (목) 00:01` — 날짜만 있는 값(`YYYY-MM-DD`)이면 시각 없이 날짜만. */
export const formatAdminDateTime = (value: AdminDateValue, fallback = '-'): string => {
  const p = partsOf(value);
  if (!p) return fallback;
  const date = `${p.y}.${pad(p.m)}.${pad(p.d)} (${WEEKDAYS[p.weekday]})`;
  return p.hh === null || p.mm === null ? date : `${date} ${pad(p.hh)}:${pad(p.mm)}`;
};

/** epoch 초(DB의 unixepoch 칸을 그대로 내려준 값) → 표시. */
export const formatAdminDateTimeFromSeconds = (sec: number | null | undefined, fallback = '-'): string =>
  sec === null || sec === undefined ? fallback : formatAdminDateTime(sec * 1000, fallback);

export const formatAdminDateFromSeconds = (sec: number | null | undefined, fallback = '-'): string =>
  sec === null || sec === undefined ? fallback : formatAdminDate(sec * 1000, fallback);
