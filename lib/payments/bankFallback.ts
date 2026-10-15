/**
 * 결제 실패 화면 → 폼의 "계좌로 직접 입금" 줄로 돌아가는 주소 규칙 — 순수 모듈(클라이언트·서버 공용).
 *
 * 결제수단은 토스(카드·간편결제)와 계좌로 직접 입금(우리 계좌번호 안내)이다(토스 계좌이체는 뱅크페이가 떠 고령층이
 * 쓰지 못해 2026-10-14에 뺐다). 결제가 막힌 분이 실패 화면에서 바로 계좌 안내로 가도록, 폼 주소에 `?bank=1`을 붙여
 * 돌려보내면 폼이 계좌 줄을 고른 채 열린다. 실패한 주문은 이미 풀려 있어 폼에서 새로 만든다.
 */
export const BANK_FALLBACK_QUERY = 'bank';

/** 폼 주소 뒤에 폴백 표식을 붙인다. 이미 쿼리가 있으면 `&`로 잇는다. */
export const bankFallbackHref = (formPath: string): string =>
  `${formPath}${formPath.includes('?') ? '&' : '?'}${BANK_FALLBACK_QUERY}=1`;

/** 주소의 쿼리(`window.location.search`)가 계좌 안내 모드로 열라는 뜻인가. */
export const wantsBankFallback = (search: string): boolean =>
  new URLSearchParams(search).get(BANK_FALLBACK_QUERY) === '1';
