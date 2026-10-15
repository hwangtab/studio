/**
 * 개설자 로그인 뒤 돌아갈 콘솔 탭. 펀딩 개설자와 공연 주최자가 같은 매직링크로 들어오므로
 * 공연 안내 페이지(/ko/shows/host)에서 받은 링크는 공연 탭으로 돌려보낸다.
 *
 * 값은 경로가 아니라 **이름**이고, 이 표에 있는 이름만 받는다 — 링크·요청 본문에서 온 값을
 * 그대로 이동 주소로 쓰면 열린 리디렉트가 된다. 표에 없으면 null(기본: 펀딩 탭).
 */
const DESTINATIONS = {
  shows: '/ko/funding/creator/shows',
} as const;

export type CreatorLoginNext = keyof typeof DESTINATIONS;

export const DEFAULT_CREATOR_LANDING = '/ko/funding/creator';

export const parseCreatorLoginNext = (value: unknown): CreatorLoginNext | null =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(DESTINATIONS, value) ? (value as CreatorLoginNext) : null;

export const creatorLandingPath = (next: CreatorLoginNext | null): string =>
  next ? DESTINATIONS[next] : DEFAULT_CREATOR_LANDING;
