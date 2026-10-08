/**
 * 브랜드색의 단일 정본 — Tailwind 토큰(tailwind.config.ts)과, Tailwind를 못 쓰는 자리(메일 HTML·정적 카드
 * 이미지·theme-color)가 같은 값을 보게 한다.
 *
 * 2026-10-09 3차 — 파랑(blue-600 계열). 운영자: "버튼은 시인성 좋게 원래 파란색 계열이, 그 버튼에 맞춰 색 체계를
 * 다시." 녹색(10/07)·잉크 버튼(10/08)을 거쳐, 파랑 = 누를 수 있는 것(버튼·링크·선택 상태·포커스)으로 정했다.
 * 가격 숫자처럼 누를 수 없는 큰 강조는 잉크(gray-950)로 둬 버튼과 겹쳐 보이지 않게 한다(docs/design-system.md §1).
 *
 * primary #2563eb 흰 위 5.17:1(AA), paper2 위 약 4.8:1. primaryDark #1d4ed8 흰 글씨 6.70:1 — solid hover·theme-color.
 * primaryLight #3b82f6 흰 3.68:1 — 대형·아이콘용(작은 텍스트 금지). primaryOnDark #93c5fd gray-900 위 약 9.9:1.
 */
export const BRAND_COLOR = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',
  primaryOnDark: '#93c5fd',
  ink: '#030712',
  paper: '#ffffff',
  paper2: '#f4f6f9',
} as const;
