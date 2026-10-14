/**
 * "계좌로 직접 입금" 폴백의 입구 — 순수 모듈(클라이언트·서버 공용).
 *
 * 모든 결제 화면의 기본은 토스(카드·간편결제·계좌이체)이고, 결제가 어려운 분만 계좌번호를 안내받는다
 * (운영자 결정 2026-10-14). 입구는 둘뿐이다:
 * 1. 폼 안의 작은 링크 — `components/payments/BankDepositFallback.tsx`.
 * 2. 결제 실패 화면의 안내 버튼 — 폼 주소에 `?bank=1`을 붙여 돌려보내면 폼이 계좌 안내 모드로 열린다.
 *    (주문은 실패 시 이미 풀렸으므로 폼에서 새로 만든다 — 토스 홀드를 거치지 않는 `awaiting_deposit` 경로.)
 */
export const BANK_FALLBACK_QUERY = 'bank';

/** 폼 주소 뒤에 폴백 표식을 붙인다. 이미 쿼리가 있으면 `&`로 잇는다. */
export const bankFallbackHref = (formPath: string): string =>
  `${formPath}${formPath.includes('?') ? '&' : '?'}${BANK_FALLBACK_QUERY}=1`;

/** 주소의 쿼리(`window.location.search`)가 계좌 안내 모드로 열라는 뜻인가. */
export const wantsBankFallback = (search: string): boolean =>
  new URLSearchParams(search).get(BANK_FALLBACK_QUERY) === '1';
