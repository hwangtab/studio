import { Noto_Sans_KR } from 'next/font/google';

// Noto Sans KR — 사이트 전반의 통합 한글 폰트.
// next/font/google이 빌드 시 self-host + auto preload + size-adjust + unicode-range
// 자동 분할 처리. weight 명시(['400','700'])로 각 weight별 chunked subset 생성.
// 900(Black)은 hero H1 LCP 지연 원인이라 제거 — font-bold(700)로 대체.
//
// LCP 최적화(2026-05-07): subsets:['latin']만 명시했을 때 한글 chunk가 lazy fetch
// 되어 PSI LCP 분석에서 'hero h1 텍스트 요소 렌더링 지연 2500ms'로 측정. next/font
// /google이 'korean' subset을 직접 지원 안 함(Noto Sans KR subsets는
// latin/latin-ext/cyrillic/vietnamese만). 대신 명시 fallback 한글 시스템 폰트 +
// adjustFontFallback(default true)로 size-adjust 자동 적용 → fallback paint와
// final paint 사이 layout shift 최소화 → Lighthouse가 fallback paint를 LCP로 측정.
//
// Montserrat 제거(2026-05-07): tailwind config display family는 Noto Sans KR
// fallback 통일.
export const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-noto-sans-kr',
  // fallback 명시 — 한글 fallback이 시스템 폰트 stack에 포함되어 첫 paint가 즉시
  // 시스템 한글 폰트로 발생. adjustFontFallback default(true)는 next/font가 자동
  // size-adjust 메트릭 보정해 layout shift 최소화 → Lighthouse가 fallback paint를
  // LCP로 측정.
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Malgun Gothic', 'system-ui', 'sans-serif'],
});
