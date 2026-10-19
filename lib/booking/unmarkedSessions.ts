/**
 * 이용 시간이 지났는데 완료·노쇼 표시가 없는 세션 예약.
 *
 * 후기 요청 메일 크론(`/api/cron/review-requests`)은 세션이 끝난 **다음 날 11:00**에 `confirmed`·`completed` 예약의
 * 고객에게 메일을 보낸다(lib/reviews/reviewRequests.ts). 노쇼 고객은 운영자가 `no_show`로 표시해 두어야 제외된다 —
 * 그 전에 표시하지 않으면 오지 않은 고객에게 후기 요청이 간다. 그런데 표시는 예약 상세를 건건이 열어야만 할 수 있어,
 * 어느 예약이 아직 표시 전인지 모아 보는 곳이 없었다.
 *
 * 메일이 아직 안 나간 건은 오늘(KST) 끝난 세션이다 — 어제 이전에 끝난 건은 이미 나갔을 수 있어 표시해도 메일은 못 막지만,
 * 완료·노쇼 기록(고객 이력·매출 분석)은 남아야 하므로 7일까지 세어 둔다. 후기 요청 메일의 재시도 창도 7일이다.
 * 더 오래된 `confirmed`는 이력이 길수록 쌓여 카드가 소음이 되므로 세지 않는다.
 */
export const UNMARKED_SESSION_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** [from, to) — 이 안에 끝났고 아직 confirmed인 예약이 대상이다. */
export const unmarkedSessionRange = (now: Date): { from: Date; to: Date } => ({
  from: new Date(now.getTime() - UNMARKED_SESSION_WINDOW_DAYS * DAY_MS),
  to: now,
});
