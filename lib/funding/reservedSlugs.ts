/**
 * 프로젝트 slug로 쓸 수 없는 이름.
 *
 * `pages/[locale]/funding/` 아래의 **리터럴 라우트**들이다. Next.js는 리터럴이 `[slug]`를
 * 이기므로, 개설자가 프로젝트를 `apply`로 지으면 `/ko/funding/apply`가 영영 신청 페이지를
 * 보여 주고 그 프로젝트의 상세는 어떤 주소로도 열리지 않는다. 오류도 나지 않는다 —
 * 그냥 다른 페이지가 뜬다.
 *
 * 새 리터럴 라우트를 그 디렉터리에 추가하면 **여기에도 넣어야 한다.**
 * `reservedSlugs.routes.test.ts`가 디렉터리를 직접 읽어 대조한다.
 */
export const RESERVED_FUNDING_SLUGS: ReadonlySet<string> = new Set([
  'apply',
  'creator',
  'terms',
  'success',
  'fail',
  'manage',
  // `[slug]/pledge`는 하위 경로라 slug 자리를 뺏지 않지만, 프로젝트 이름이 'pledge'면
  // `/ko/funding/pledge/pledge` 같은 주소가 생겨 사람이 읽기 어렵다.
  'pledge',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 80;

export const normalizeFundingSlug = (input: string): string | null => {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return null;
  if (!SLUG_PATTERN.test(trimmed)) return null;
  return trimmed;
};

export const slugRejectionReason = (slug: string): string | null => {
  const normalized = normalizeFundingSlug(slug);
  if (!normalized) {
    return `주소는 영문 소문자·숫자·하이픈만 쓸 수 있고 ${MIN_LENGTH}~${MAX_LENGTH}자여야 합니다.`;
  }
  if (RESERVED_FUNDING_SLUGS.has(normalized)) {
    return '이미 사이트가 쓰고 있는 주소라 사용할 수 없습니다. 다른 주소를 적어 주세요.';
  }
  return null;
};
