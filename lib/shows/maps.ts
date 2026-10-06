/**
 * 공연장 지도 — 모든 공연이 같은 틀을 쓴다. 순수 모듈(DB·fs 없음)이라 서버·클라이언트 모두 가져다 쓴다.
 *
 * **지도 제공자마다 잘 먹는 검색어가 다르다**(2026-10-04 실측, 삼청로 83):
 * - 네이버·구글: `장소명 + 도로명 주소`가 정확하다(가게 이름·평점까지).
 * - 카카오맵: 합친 검색어는 "검색 결과가 없어요"가 된다. **도로명 주소만** 넣으면 그 번지에 핀이 찍힌다.
 * - 셋 모두 "가동 1층" 같은 건물 안쪽 표기가 붙으면 못 찾거나 엉뚱한 구역을 보여 준다 → 건물 번호까지만 쓴다.
 * 그래서 검색어를 만드는 일을 제공자 목록(SHOW_MAP_PROVIDERS)이 각자 한다. 새 제공자는 목록에 한 줄만 더하면
 * 버튼이 자동으로 늘어난다(ShowVenueMap·ShowFacts가 목록을 돈다).
 *
 * 정확한 장소 링크가 있으면(네이버 장소 단축 주소, 카카오 `place.map.kakao.com/<id>` 등) 공연 정의의 `mapLinks`로
 * 제공자별로 검색 대신 그 주소를 쓴다 — 검색이 같은 건물의 다른 가게를 잡는 경우의 탈출구다.
 */

const SHOW_MAP_PROVIDER_IDS = ['naver', 'kakao'] as const;
export type MapProviderId = (typeof SHOW_MAP_PROVIDER_IDS)[number];
export type MapLinkOverrides = Partial<Record<MapProviderId, string>>;

export interface MapSource {
  venueName: string;
  venueAddress: string;
}

/** 도로명 주소에서 건물 안쪽 표기(동·층)를 뗀 건물 번호까지. "서울 종로구 삼청로 83 가동 1층" → "서울 종로구 삼청로 83". */
export const showMapStreet = (show: Pick<MapSource, 'venueAddress'>): string =>
  show.venueAddress
    .replace(/\s+(?:[가-힣A-Za-z]동\s*)?(?:지하\s*|B)?\d+층.*$/i, '')
    .replace(/\s+[가-힣A-Za-z]동\b.*$/, '')
    .trim();

/** 장소명 + 건물 번호까지의 주소 — 네이버·구글 검색어, 지도 임베드 검색어. */
export const showMapQuery = (show: MapSource): string => `${show.venueName} ${showMapStreet(show)}`.trim();

const enc = encodeURIComponent;

interface MapProvider {
  id: MapProviderId;
  label: string;
  /** 이 제공자에서 공연장을 찾는 검색 주소. */
  searchUrl: (show: MapSource) => string;
}

export const SHOW_MAP_PROVIDERS: readonly MapProvider[] = [
  { id: 'naver', label: '네이버 지도', searchUrl: (s) => `https://map.naver.com/p/search/${enc(showMapQuery(s))}` },
  // 카카오맵은 장소명을 섞으면 결과가 없다 — 도로명 주소만(위 주석).
  { id: 'kakao', label: '카카오맵', searchUrl: (s) => `https://map.kakao.com/link/search/${enc(showMapStreet(s))}` },
];

export interface ShowMapLink {
  id: MapProviderId;
  label: string;
  url: string;
  /** 공연 정의가 직접 준 주소인지(검색이 아니라). */
  custom: boolean;
}

/** 제공자별 길찾기 링크. 공연 정의의 `mapLinks`가 있는 제공자는 검색 대신 그 주소를 쓴다. */
export const showMapLinks = (show: MapSource & { mapLinks?: MapLinkOverrides }): ShowMapLink[] =>
  SHOW_MAP_PROVIDERS.map((p) => {
    const custom = show.mapLinks?.[p.id];
    return { id: p.id, label: p.label, url: custom ?? p.searchUrl(show), custom: Boolean(custom) };
  });

/**
 * 카카오맵을 못 띄울 때(ShowVenueMap 폴백) 쓰는 지도 iframe 주소 — 구글 지도의 키 없는 임베드(`?q=…&output=embed`,
 * iframe 안에서만 열린다). 평소 지도는 카카오맵이다(components/maps/KakaoMap.tsx). 연락처 페이지는 스튜디오
 * 한 곳의 고정 `pb=` 토큰을 쓰지만 공연장은 공연마다 달라 검색어로 찾는다. 허용 origin은 middleware.ts의 CSP
 * frame-src(www.google.com).
 */
export const showMapEmbedUrl = (show: MapSource): string =>
  `https://www.google.com/maps?q=${enc(showMapQuery(show))}&z=17&hl=ko&output=embed`;

// ─── 저장 형식(shows.map_links_json) ──────────────────────────────────────────────

const isProviderId = (k: string): k is MapProviderId => (SHOW_MAP_PROVIDER_IDS as readonly string[]).includes(k);

/** 알 수 없는 제공자·https가 아닌 주소는 조용히 버린다 — 링크 하나 때문에 상세가 500이 되면 안 된다. */
export function parseMapLinksJson(text: string | null | undefined): MapLinkOverrides {
  if (!text) return {};
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const out: MapLinkOverrides = {};
    for (const [k, v] of Object.entries(raw)) {
      if (isProviderId(k) && typeof v === 'string' && /^https:\/\//.test(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export const serializeMapLinks = (links: MapLinkOverrides | undefined): string | null =>
  links && Object.keys(links).length > 0 ? JSON.stringify(links) : null;

/** 공연 정의 검증용 — 알 수 없는 제공자·https가 아닌 주소를 오류로 돌려준다. */
export function validateMapLinks(links: Record<string, string> | undefined): string[] {
  const errors: string[] = [];
  for (const [k, v] of Object.entries(links ?? {})) {
    if (!isProviderId(k)) errors.push(`mapLinks: 알 수 없는 지도 제공자 "${k}" (${SHOW_MAP_PROVIDER_IDS.join(', ')})`);
    else if (!/^https:\/\//.test(v)) errors.push(`mapLinks.${k}: https 주소여야 합니다.`);
  }
  return errors;
}
