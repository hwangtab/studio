/**
 * 광역시·도 단위 지역 허브 페이지 slug 화이트리스트.
 *
 * 일반 시·군 지역 페이지는 boilerplate 비율이 높아 thin-content 게이트로
 * noindex 처리하지만, 광역 허브는 사이트 정보 구조상 색인되어야 한다
 * (지방 사용자가 자기 광역에서 접근하는 진입점 역할).
 *
 * 광역 허브와 일반 지역 페이지의 unique 본문 길이 분포가 거의 동일해
 * 글자 수 임계값으로 둘을 구분할 수 없으므로 명시적 화이트리스트가 필요하다.
 *
 * 새 광역 허브 추가 시 이 파일에 slug 등록 + next-sitemap.config.js의
 * REGION_HUB_SLUGS와 동기화 유지.
 */
export const REGION_HUB_SLUGS = new Set<string>([
  // 광역시
  'incheon1',
  'gwangju1',
  'daegu1',
  'busan1',
  'ulsan1',
  'daejeon1',
  'sejong1',
  // 도(道)
  'gangwon1',
  'chungbuk1',
  'chungnam1',
  'jeonbuk1',
  'jeonnam1',
  'gyeongbuk1',
  'gyeongnam1',
  'jeju1',
  // 전국 단위 가이드
  'nationwide1',
]);

export const isRegionHub = (slug: string): boolean => REGION_HUB_SLUGS.has(slug);
