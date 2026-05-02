import { Montserrat, Noto_Sans_KR } from 'next/font/google';

export const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

// Noto Sans KR — 사이트 전반의 통합 한글 폰트.
// next/font/google이 빌드 시 self-host + auto preload + size-adjust + unicode-range
// 자동 분할 처리. weight 명시(['400','700','900'])로 각 weight별 chunked subset 생성.
// 한글 사용 글자가 포함된 chunk만 lazy fetch되어 페이지당 부담 미미.
export const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  display: 'swap',
  variable: '--font-noto-sans-kr',
});
