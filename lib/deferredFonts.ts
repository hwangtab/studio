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

/**
 * 모든 deferred 폰트의 선언 목록.
 *
 * PartialSansKR은 히어로 h1에만 쓰이는 브랜드 폰트로, 첫 방문자에게도 즉시
 * 노출되어야 UX상 자연스럽다. 지연 주입 + optional은 캐시 미스로 영원히
 * 안 보이고, 지연 주입 + swap은 4~6초 뒤에야 나타남. 그래서 PartialSansKR만
 * styles/globals.css의 정식 @font-face(display: swap)로 분리했다.
 * 여기 DEFERRED_FONTS에는 포함하지 않는다.
 */
export const DEFERRED_FONTS: readonly DeferredFontDef[] = [
  // Pretendard — 본문/타이틀 전반의 주 폰트. 3 weight.
  // display: optional — 본문 전역 사용이라 swap 시 대규모 repaint → TBT 회귀 위험.
  // 재방문 시 캐시된 Pretendard 즉시 적용, 첫 방문은 시스템 폰트 유지.
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
