/**
 * 브랜드색의 단일 정본 — Tailwind 토큰(tailwind.config.ts)과, Tailwind를 못 쓰는 자리(메일 HTML·정적 카드
 * 이미지·theme-color)가 같은 값을 보게 한다. 값의 근거와 대비 실측은 docs/design-liner-notes-plan-2026-10.md §3-1.
 *
 * 2026-10-07 2차 개정 — 운영자가 1차 값(짙은 포레스트 그린 `#166534` + 따뜻한 베이지 `#faf7f2`/`#f2ede4`)을
 * "텁텁하다"며 반려하고 "도시적이고 세련된" 쪽을 요청했다. 진단: 따뜻한 베이지 바탕이 올리브 톤 그린과
 * 짝지어지며 코지·전통적으로 읽혔다(도시적이지 않음) — 바탕을 차갑고 깨끗한 흰색/근접백으로 바꾸고,
 * primary는 같은 "로고 녹색" 계열을 유지하되 올리브가 아니라 에메랄드 쪽으로 틀어 더 선명·채도 높게 올렸다.
 *
 * primary(에메랄드-800 계열) 흰 배경 7.68:1(AA 여유), 종이(paper2) 배경 약 7.0:1. ring-primary/70 합성값은
 * 흰 배경 3.76:1·paper2 배경 3.58:1로 SC 1.4.11(3:1) 통과(1차 값보다 여유 확보). primaryDark는 히어로 잉크
 * 면·solid hover용 — 흰 글씨 12.5:1. primaryOnDark(다크 바탕 gray-900 위 텍스트 짝)는 1차와 동일하게 유지
 * (이미 13.2:1로 충분히 선명하고 무디지 않다).
 */
export const BRAND_COLOR = {
  primary: '#065f46',
  primaryLight: '#059669',
  primaryDark: '#0b3b2c',
  primaryOnDark: '#6ee7b7',
  ink: '#030712',
  paper: '#ffffff',
  paper2: '#f2f5f3',
} as const;
