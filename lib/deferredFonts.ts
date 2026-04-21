/**
 * 크리티컬 패스 밖에서 주입될 웹폰트 정의.
 *
 * pages/_app.tsx의 useEffect(window.load + 3s)에서 buildDeferredFontCSS()로
 * @font-face 문자열을 생성해 <style> 태그로 주입한다. font-display: optional
 * 전략이라 초기 페인트는 시스템 폰트, 재방문 시 캐시된 폰트로 즉시 적용된다.
 *
 * 폰트 추가 방법: DEFERRED_FONTS 배열에 DeferredFontDef 객체 하나 추가.
 * (public/fonts/에 파일 배치 + tailwind.config.ts font-family 체인 갱신 필요)
 */

export interface DeferredFontSource {
  /** CSS `local()` 힌트 — 사용자 OS에 설치된 경우 즉시 활용. */
  localNames?: readonly string[];
  /** woff2 URL. 자기 도메인 상대경로(/fonts/...) 또는 CDN. */
  url: string;
}

export interface DeferredFontDef {
  family: string;
  /** CSS font-weight. 미지정 시 `normal`. */
  weight?: number | 'normal' | 'bold';
  /** CSS font-style. 기본 `normal`. */
  style?: string;
  /** font-display. 기본 `optional` — 크리티컬 패스 밖 주입에 최적. */
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  /** fallback chain — 첫 번째부터 시도. */
  sources: readonly DeferredFontSource[];
  ascentOverride?: string;
  descentOverride?: string;
  lineGapOverride?: string;
}

const PRETENDARD_WEIGHTS = [
  { name: 'Regular', weight: 400 },
  { name: 'SemiBold', weight: 600 },
  { name: 'Bold', weight: 700 },
] as const;

const pretendardCdnSubset = (name: string) =>
  `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2-subset/Pretendard-${name}.subset.woff2`;

const partialSansCdn =
  'https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2307-1@1.1/PartialSansKR-Regular.woff2';

const partialSansSources: readonly DeferredFontSource[] = [
  { localNames: ['PartialSansKR-Regular'], url: '/fonts/PartialSansKR-Regular.woff2' },
  { url: partialSansCdn },
] as const;

/**
 * 모든 deferred 폰트의 선언 목록.
 */
export const DEFERRED_FONTS: readonly DeferredFontDef[] = [
  // Pretendard — 본문/타이틀 전반의 주 폰트. 3 weight.
  ...PRETENDARD_WEIGHTS.map<DeferredFontDef>(({ name, weight }) => ({
    family: 'Pretendard',
    weight,
    sources: [
      {
        localNames: [`Pretendard ${name}`, `Pretendard-${name}`],
        url: `/fonts/Pretendard-${name}.woff2`,
      },
      { url: pretendardCdnSubset(name) },
    ],
  })),

  // PartialSansKR — 히어로 타이틀(font-logo) 전용 브랜드 폰트.
  // display: swap — 히어로 h1 단 하나에만 쓰이므로 도착 시 repaint 비용이 미미.
  // optional이면 첫 방문자는 캐시 미스로 영원히 안 보이는 문제가 있어 swap 선택.
  // -Regular와 -Logo 두 별칭: Logo는 ascent/descent override로 상단 여백 조정.
  {
    family: 'PartialSansKR-Regular',
    display: 'swap',
    sources: partialSansSources,
  },
  {
    family: 'PartialSansKR-Logo',
    display: 'swap',
    sources: partialSansSources,
    ascentOverride: '80%',
    descentOverride: '20%',
    lineGapOverride: '0%',
  },
];

/**
 * @font-face CSS 문자열 생성. 공백 최소화해 injection 비용 감소.
 */
export function buildDeferredFontCSS(
  fonts: readonly DeferredFontDef[] = DEFERRED_FONTS
): string {
  return fonts.map(buildSingleFace).join('');
}

function buildSingleFace(font: DeferredFontDef): string {
  const props: string[] = [
    `font-family:'${font.family}'`,
    `font-weight:${font.weight ?? 'normal'}`,
    `font-style:${font.style ?? 'normal'}`,
    `font-display:${font.display ?? 'optional'}`,
    `src:${buildSrcValue(font.sources)}`,
  ];
  if (font.ascentOverride) props.push(`ascent-override:${font.ascentOverride}`);
  if (font.descentOverride) props.push(`descent-override:${font.descentOverride}`);
  if (font.lineGapOverride) props.push(`line-gap-override:${font.lineGapOverride}`);
  return `@font-face{${props.join(';')};}`;
}

function buildSrcValue(sources: readonly DeferredFontSource[]): string {
  const parts: string[] = [];
  for (const s of sources) {
    if (s.localNames) {
      for (const ln of s.localNames) parts.push(`local('${ln}')`);
    }
    parts.push(`url('${s.url}') format('woff2')`);
  }
  return parts.join(',');
}
