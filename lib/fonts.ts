import { Noto_Sans_KR } from 'next/font/google';

// Noto Sans KR — 사이트 전반의 통합 한글 폰트.
// next/font/google이 빌드 시 self-host + auto preload + size-adjust + unicode-range
// 자동 분할 처리. weight 명시(['400','700'])로 각 weight별 chunked subset 생성.
// 한글 사용 글자가 포함된 chunk만 lazy fetch되어 페이지당 부담 미미.
// 900(Black)은 hero H1 LCP 지연 원인이라 제거 — font-bold(700)로 대체.
//
// Montserrat 제거(2026-05-07): tailwind config의 display family에 var
// (--font-montserrat)이 매핑됐지만 font-display 클래스·var(--font-montserrat)
// 직접 참조가 코드에 0건. 4 weight Latin subset이 build에 포함되며 실 사용 없는
// 폰트 fetch가 발생해 LCP·TBT 손실. tailwind display family는 Noto Sans KR로
// 폴백 처리.
export const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-noto-sans-kr',
});
