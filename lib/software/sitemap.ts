/**
 * 소프트웨어 런타임 사이트맵의 URL 목록 — 순수 함수. 읽는 쪽은 pages/sitemap-software.xml.ts.
 *
 * 판매가 닫혀 있으면(SOFTWARE_SALES_OPEN=false) 목록·상세가 noindex라 하나도 싣지 않는다. 공개 상품이 없어도 빈 목록.
 * 화면이 ko·en 두 벌이라 둘 다 싣는다. lastmod는 싣지 않는다(루트 CLAUDE.md lastmod 정책 — 수정 시각의 정본이 없다).
 */
export const buildSoftwareSitemapPaths = (input: { open: boolean; productSlugs: readonly string[] }): string[] => {
  if (!input.open || input.productSlugs.length === 0) return [];
  return (['ko', 'en'] as const).flatMap((locale) => [`/${locale}/software`, ...input.productSlugs.map((s) => `/${locale}/software/${s}`)]);
};
