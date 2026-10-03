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

/** 'YYYY-MM' 회차의 청구 시각 = 그 달 billingDay 09:00 KST(그 달에 그 날이 없으면 말일). */
export const billingDateOf = (cycleYm: string, billingDay: number): Date => {
  const [year, month] = cycleYm.split('-').map(Number);
  return fromKst(year, month, Math.min(billingDay, daysInMonth(year, month)));
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

/**
 * 밀린 회차를 걷은 직전에 다음 회차를 걷기까지 비워 두는 최소 간격(일).
 *
 * 마지막 재시도 간격(D+3)과 같게 잡았다 — 방금 살아난 카드에 같은 금액을 다음 날 또 거는 것은
 * 고객에게 "두 번 빠져나갔다"로 읽히고, 한도가 겨우 회복된 카드라면 그대로 거절된다.
 */
export const CATCH_UP_GAP_DAYS = RETRY_OFFSETS_DAYS[RETRY_OFFSETS_DAYS.length - 1];

/** 그 달 말일 청구 시각(KST 09:00) — 그 달 회차를 cron이 걷을 수 있는 마지막 순간. */
const lastBillingMomentOfMonth = (d: Date): Date => {
  const { year, month } = kstParts(d);
  return fromKst(year, month, daysInMonth(year, month));
};

const later = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);

export interface PaidCycleSchedule {
  /** 이번 결제가 덮는 기간의 시작 기준. */
  anchor: Date;
  period: { start: Date; end: Date };
  nextBillingAt: Date;
}

/**
 * 회차 `cycleYm`이 `now`에 결제됐을 때의 이용기간과 다음 청구 시각.
 *
 * 청구 성공(`chargeCycle`)과 웹훅·대사 복구(`reconcileSubscriptionPaymentFromToss`)가 **둘 다
 * 이 함수만 쓴다.** 두 곳이 다르게 계산하면 같은 회차가 어느 경로로 반영됐느냐에 따라 다음
 * 청구일이 달라진다 — 실제로 복구 경로만 `now` 기준으로 남아, 9/30 청구가 NETWORK_ERROR로
 * 끝나고 10/1에 DONE이 확인되면 다음 청구가 11/30이 되어 10월분이 사라졌다.
 *
 * ## 앵커
 *
 * `bindToCycle`(연습실·레슨)이고 회차가 지금 달이 아니면 그 회차의 청구일이 기준이다 — 실패했던
 * 달을 이어서 걷는 것이므로 기간도 그 달이다. 그 밖에는 `now`가 기준이다(아티스트 후원은 회차를
 * 지금 달로 잡으므로 언제나 여기다).
 *
 * ## 앵커 기준 다음 청구일이 이미 지난 경우
 *
 * 결제일 1일 구독의 9월분을 10/1에 걷으면 기간은 9/1~10/1이고 앵커 기준 다음 청구일(10/1)이
 * `now` 이하다. 10월분도 이미 낼 날이 지났으므로 **다음 cron이 10월분을 걷는 것 자체는 맞다**
 * — 그 달을 건너뛰면 #448이 막으려던 "실패한 달이 사라지는" 사고가 이번엔 다음 달에서 난다.
 * 그대로 두면 문제가 되는 것은 **시점**이다: 10/1에 9월분, 10/2에 10월분이 연달아 빠져나간다.
 *
 * 그래서 다음 청구를 `now + CATCH_UP_GAP_DAYS` 이후로 미루되 **이번 달 안에** 둔다. 청구는
 * 그 순간의 달(`cycleYmOf`)을 회차로 잡으므로, 다음 달로 넘기면 이번 달 회차가 건너뛰어진다.
 * 이번 달 청구일이 아직 오지 않았으면(여러 달 밀린 정지 뒤의 수동 결제) 그 날짜가 먼저다.
 *
 * **운영자 확정(2026-10-03): 월말 연속 청구를 허용한다 — 그 달 회차를 포기하는 쪽으로 바꾸지 말 것.**
 * 간격을 이번 달 안에 둘 수 없는 월말에는 이번 달 회차를 걷는 쪽을 택한다 — 말일 청구 시각이
 * 아직 남아 있으면 그때 걷는다(그래서 **월말에 한해** 이틀 연속 청구가 남는다; 이번 달을
 * 통째로 걷지 않는 것보다 낫다). 말일 청구 시각마저 지났으면 cron이 이번 달 회차를 걷을 길이
 * 없으니 다음 정기 청구일로 가되, 그것도 간격 안이면 간격 뒤로 민다.
 */
export const scheduleForPaidCycle = (input: {
  cycleYm: string;
  billingDay: number;
  now: Date;
  bindToCycle: boolean;
}): PaidCycleSchedule => {
  const { cycleYm, billingDay, now, bindToCycle } = input;
  const anchor = bindToCycle && cycleYm !== cycleYmOf(now) ? billingDateOf(cycleYm, billingDay) : now;
  const period = periodFor(anchor, billingDay);
  if (period.end.getTime() > now.getTime()) return { anchor, period, nextBillingAt: period.end };

  // 간격 끝 날의 청구 시각(09:00 KST)으로 맞춘다. now + 3일을 그대로 쓰면 cron이 09:00:0x에 돌며
  // 남긴 몇 초 때문에 그날 cron(09:00:00)이 놓치고 하루가 더 밀린다.
  const gapDay = kstParts(new Date(now.getTime() + CATCH_UP_GAP_DAYS * DAY_MS));
  const earliest = fromKst(gapDay.year, gapDay.month, gapDay.day);
  const monthLast = lastBillingMomentOfMonth(now);
  const preferred = later(billingDateOf(cycleYmOf(now), billingDay), earliest);
  if (preferred.getTime() <= monthLast.getTime()) return { anchor, period, nextBillingAt: preferred };
  if (monthLast.getTime() > now.getTime()) return { anchor, period, nextBillingAt: monthLast };
  return { anchor, period, nextBillingAt: later(computeNextBillingAt(now, billingDay), earliest) };
};

/** 실패 회차의 다음 재시도 시각. attempt는 방금 실패한 시도 번호(1부터). */
export const retryAtFor = (failedAt: Date, attempt: number): Date | null => {
  const offset = RETRY_OFFSETS_DAYS[attempt - 1];
  if (offset === undefined) return null; // 한도 소진 — 재시도하지 않는다(paused)
  return new Date(failedAt.getTime() + offset * DAY_MS);
};

/**
 * 관리자 화면의 날짜 입력('YYYY-MM-DD') → 그날 00:00 KST의 UTC Date.
 *
 * `new Date('2026-10-01')`은 **UTC 자정**으로 읽혀 KST로는 그 전날 09:00이 된다 — 하루
 * 어긋난 날짜가 그대로 저장된다. 이 파일의 다른 계산이 전부 KST 벽시계 기준이므로 입력도
 * 같은 기준으로 받는다.
 *
 * 00:00을 쓰는 이유: 청구 cron은 09:00 KST(UTC 00:00)에 돌므로, 운영자가 적은 그 날의
 * 실행에서 정지가 풀린다. 09:00을 쓰면 `<=` 비교가 경계에서 걸리긴 하나 같은 순간이라
 * 실행 지연 몇 초에 하루가 밀린다.
 */
export const parseKstDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return fromKst(year, month, day, 0);
};
