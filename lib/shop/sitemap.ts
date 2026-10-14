/**
 * 상점 런타임 사이트맵의 URL 목록 — 순수 함수(상수를 주입해 테스트한다). 읽는 쪽은 pages/sitemap-shop.xml.ts.
 *
 * 판매가 닫혀 있으면(SHOP_SALES_OPEN=false) 목록·상세가 noindex라 하나도 싣지 않는다.
 * lastmod는 싣지 않는다 — 상품에 수정 시각이 없고, 파일 mtime·빌드 시각은 쓰지 않는다(루트 CLAUDE.md lastmod 정책).
 */
export const buildShopSitemapPaths = (input: {
  open: boolean;
  productSlugs: readonly string[];
  artistSlugs: readonly string[];
}): string[] => {
  if (!input.open) return [];
  // 공개 상품이 하나도 없으면 빈 목록을 색인에 내밀지 않는다(공연 사이트맵과 같다).
  if (input.productSlugs.length === 0) return [];
  return [
    '/ko/shop',
    ...input.productSlugs.map((s) => `/ko/shop/${s}`),
    ...input.artistSlugs.map((s) => `/ko/shop/artist/${s}`),
  ];
};
