/**
 * 매출·지출을 나누는 **사업 분야** — 연습실 / 녹음·제작 / 플랫폼 / 기타. 관리자 매출 현황의 "분야별 매출·수익"과 대시보드 카드가 쓴다.
 * 이 모듈은 아무것도 import하지 않는다(관리자 화면 클라이언트 번들과 서버가 같은 판정을 쓴다).
 *
 * 행의 분야는 `RevenueRow.line`이 있으면 그것, 없으면 유형(`type`)의 기본 분야다:
 * - 연습실: 월 입주(tenancy), 연습실 시간제 예약(session 중 `serviceType = practice-room` — loadRevenueRows가 `line`을 채운다),
 *   연습실 월 이용료 카드 구독(subscription 중 `kind = practice-room` — 같은 곳에서 채운다).
 * - 녹음·제작: 녹음실 세션 예약, 믹싱·마스터링, 음원 제작 계약, 결제 링크(deposit — 링크마다 분야를 고를 수 있고 고르지 않으면 여기).
 * - 플랫폼: 펀딩·공연·상점 수수료(platformFee.ts — 정산 몫을 뺀 스튜디오 몫), 아티스트 구독(subscription 중 `kind = artist-support`).
 * - 기타: 프로듀싱 레슨·소프트웨어·기타, 그리고 분야를 모르는 행.
 *
 * 레슨·소프트웨어를 '기타'에 둔 것은 운영자 지정이다(2026-10-21). 관리자 메뉴는 레슨을 녹음실, 소프트웨어를 플랫폼 아래에 두므로
 * 옮기기로 하면 아래 `DEFAULT_LINE_OF_TYPE` 한 줄만 고치면 된다.
 */
export const BUSINESS_LINES = ['practice', 'recording', 'platform', 'other'] as const;
export type BusinessLine = (typeof BUSINESS_LINES)[number];

export const BUSINESS_LINE_LABELS: Record<BusinessLine, string> = {
  practice: '연습실',
  recording: '녹음·제작',
  platform: '플랫폼',
  other: '기타',
};

export const parseBusinessLine = (value: unknown): BusinessLine | null => {
  const v = Array.isArray(value) ? value[0] : value;
  return (BUSINESS_LINES as readonly unknown[]).includes(v) ? (v as BusinessLine) : null;
};

/** 유형의 기본 분야. 여기 없는 유형은 '기타'. `session`은 행이 `line`을 못 받았을 때(수기 매출 등)의 기본값이다. */
export const DEFAULT_LINE_OF_TYPE: Record<string, BusinessLine> = {
  tenancy: 'practice',
  session: 'recording',
  mixing: 'recording',
  production: 'recording',
  deposit: 'recording',
  funding: 'platform',
  ticket: 'platform',
  merch: 'platform',
  lesson: 'other',
  software: 'other',
  subscription: 'other',
  other: 'other',
};

export const lineOfType = (type: string): BusinessLine => DEFAULT_LINE_OF_TYPE[type] ?? 'other';

export const lineOfRow = (row: { type: string; line?: BusinessLine | null }): BusinessLine => row.line ?? lineOfType(row.type);

/** 세션 예약의 서비스 종류 → 분야(lib/booking/line.ts의 practice/studio 판정과 같다). */
export const lineOfSessionService = (serviceType: string | null | undefined): BusinessLine | null =>
  serviceType ? (serviceType === 'practice-room' ? 'practice' : 'recording') : null;

/** 구독 종류 → 분야. 레슨 구독은 유형 자체가 `lesson`으로 바뀌므로 여기서는 기타. */
export const lineOfSubscriptionKind = (kind: string | null | undefined): BusinessLine | null => {
  if (kind === 'practice-room') return 'practice';
  if (kind === 'artist-support') return 'platform';
  if (kind === 'lesson') return 'other';
  return null;
};

// ─── 지출 ───────────────────────────────────────────────────────────────────────────────────

/** 지출 구분 → 분야. 저장값 'studio'는 예전 "스튜디오 전체"로, 지금은 **공통**(분야를 나누기 어려운 비용)이다 — 데이터를 옮기지 않고 이름만 바꿨다. */
export type ExpenseBucket = BusinessLine | 'common';

export const expenseBucketOfScope = (scope: string): ExpenseBucket => {
  if (scope === 'practice' || scope === 'recording' || scope === 'platform') return scope;
  return 'common';
};
