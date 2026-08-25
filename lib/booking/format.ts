/**
 * 예약 관리자 화면 날짜 표기.
 *
 * booking 도메인은 이미 +9시간 고정 오프셋 방식을 쓰고 있다(kst.ts, lib/booking/email.ts
 * kstTimeLabel, pages/[locale]/booking/manage/[orderNo].tsx formatKstDateTime). 한국은
 * DST가 없어 고정 오프셋으로 충분하고, 이 파일은 그 관례를 관리자 화면에도 그대로 잇는다
 * (lib/contracts/format.ts의 Intl+Asia/Seoul 방식과는 다르지만, 도메인 안에서는 통일한다).
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const toKst = (isoString: string): Date => new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000);

/** '2026-09-10T05:00:00.000Z' → '2026.09.10 (목) 14:00'. 예약 시작 시각은 항상 정시다. */
export const formatKstDateTime = (isoString: string | null): string => {
  if (!isoString) return '-';
  const kst = toKst(isoString);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  return `${y}.${m}.${d} (${WEEKDAYS[kst.getUTCDay()]}) ${hh}:00`;
};

/** 결제 승인·환불 시각처럼 정시가 아닐 수 있는 값 — 분까지 표기. */
export const formatKstDateTimeFull = (isoString: string | null): string => {
  if (!isoString) return '-';
  const kst = toKst(isoString);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} (${WEEKDAYS[kst.getUTCDay()]}) ${hh}:${mm}`;
};
