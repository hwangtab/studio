/**
 * 공연 slug로 쓸 수 없는 이름 — `pages/[locale]/shows/` 아래 리터럴 라우트와
 * `pages/api/shows/` 아래 리터럴 이름.
 *
 * 리터럴 라우트가 `[slug]`를 이기므로 공연을 `scan`으로 지으면 그 상세는 어떤 주소로도 안 열리고
 * 오류도 나지 않는다(lib/funding/reservedSlugs.ts와 같은 함정). 새 리터럴 라우트를 추가하면 여기에도 넣는다.
 */
export const RESERVED_SHOW_SLUGS: ReadonlySet<string> = new Set([
  'scan',
  'report',
  'success',
  'fail',
  'manage',
  // pages/api/shows/ 아래 리터럴들
  'orders',
  'refund',
  'checkin',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateShowSlug(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) return 'slug는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.';
  if (slug.length < 3 || slug.length > 80) return 'slug는 3~80자여야 합니다.';
  if (RESERVED_SHOW_SLUGS.has(slug)) return `slug "${slug}"는 예약어라 쓸 수 없습니다.`;
  return null;
}
