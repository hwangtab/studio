/**
 * 정기결제 일정 계산. 전부 KST 벽시계 기준이다 — 고객이 보는 "매월 5일"은 UTC 5일이
 * 아니고, 09:00 KST는 UTC 00:00이라 Vercel Cron(UTC 00:00) 실행과 정확히 맞물린다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 DST가 없어 고정 오프셋으로 충분 (booking/kst.ts와 동일)

/** 청구 시각(KST 시). 아침에 걸어야 카드사 거절을 당일 안에 수습할 수 있다. */
export const BILLING_HOUR_KST = 9;

/**
 * 실패한 회차의 재시도 간격(일).
 *
 * 스펙 §9: cron이 KST 09:00 하루 한 번이라 "당일 재시도"는 물리적으로 불가능하다.
 * D+1·D+3 두 번으로 확정했고, 그 뒤는 관리자 수동 결제다. 최초 1회 + 재시도 2회 = 3회.
 */
export const RETRY_OFFSETS_DAYS = [1, 3] as const;
export const MAX_CHARGE_ATTEMPTS = RETRY_OFFSETS_DAYS.length + 1;

const DAY_MS = 24 * 60 * 60 * 1000;

const kstParts = (d: Date): { year: number; month: number; day: number } => {
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
};

/** 그 달의 마지막 날. 윤년은 Date가 알아서 안다(2월에 0일 = 1월 31일 식의 뒤로 감기). */
export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** KST 벽시계 (year, month, day, hour) → UTC Date. */
const fromKst = (year: number, month: number, day: number, hour = BILLING_HOUR_KST): Date =>
  new Date(Date.UTC(year, month - 1, day, hour) - KST_OFFSET_MS);

/** 'YYYY-MM' (KST). 회차 식별자 겸 멱등키 구성요소. */
export const cycleYmOf = (d: Date): string => {
  const { year, month } = kstParts(d);
  return `${year}-${String(month).padStart(2, '0')}`;
};

/**
 * 다음 청구 시각 = 다음 달 billingDay 09:00 KST.
 *
 * 그 달에 그 날이 없으면 말일로 당긴다(31일 구독의 2월·4월 — 계약 제2조 ①과 같은 규칙).
 * "31일 → 2월 28일"로 당겨도 그 다음 달은 다시 31일로 돌아온다. billingDay가 정본이고
 * 직전 청구일은 계산에 쓰지 않기 때문이다.
 */
export const computeNextBillingAt = (from: Date, billingDay: number): Date => {
  const { year, month } = kstParts(from);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const day = Math.min(billingDay, daysInMonth(nextYear, nextMonth));
  return fromKst(nextYear, nextMonth, day);
};

/**
 * 이번에 결제한 한 달치가 덮는 기간. 끝은 다음 청구 시각과 같다 — 해지하면 endsAt이
 * 여기가 되므로, 기간 끝과 다음 청구일이 어긋나면 결제한 하루가 사라지거나 겹친다.
 */
export const periodFor = (chargeAt: Date, billingDay: number): { start: Date; end: Date } => ({
  start: chargeAt,
  end: computeNextBillingAt(chargeAt, billingDay),
});

/** 실패 회차의 다음 재시도 시각. attempt는 방금 실패한 시도 번호(1부터). */
export const retryAtFor = (failedAt: Date, attempt: number): Date | null => {
  const offset = RETRY_OFFSETS_DAYS[attempt - 1];
  if (offset === undefined) return null; // 한도 소진 — 재시도하지 않는다(paused)
  return new Date(failedAt.getTime() + offset * DAY_MS);
};
