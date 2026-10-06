/**
 * 브랜드색의 단일 정본 — Tailwind 토큰(tailwind.config.ts)과, Tailwind를 못 쓰는 자리(메일 HTML·정적 카드
 * 이미지·theme-color)가 같은 값을 보게 한다. 값의 근거와 대비 실측은 docs/design-liner-notes-plan-2026-10.md §3-1.
 *
 * primary는 로고(public/logo/logo.png)의 짙은 녹색 계열이다. 흰 배경 7.13:1(AA), 종이 배경 6.67:1.
 * primaryDark는 로고 픽셀 평균값 그대로 — 히어로 잉크 면·solid hover·큰 면. primaryOnDark는 다크 바탕
 * (gray-900) 위 텍스트 짝으로 13.2:1.
 */
export const BRAND_COLOR = {
  primary: '#166534',
  primaryLight: '#15803d',
  primaryDark: '#0e3c26',
  primaryOnDark: '#6ee7b7',
  ink: '#030712',
  paper: '#faf7f2',
  paper2: '#f2ede4',
} as const;
