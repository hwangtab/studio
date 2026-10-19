/**
 * 정산 월 형식(YYYY-MM). 관리자 화면(클라이언트 번들)이 쓰므로 순수 모듈로 둔다 — payout.ts는 토스 호출·구독 서비스
 * (node:crypto)를 import해 클라이언트 번들에 들어가면 빌드가 깨진다.
 */
export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
