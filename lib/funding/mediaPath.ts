/**
 * 개설자 업로드 이미지 라우트가 받아도 되는 경로인지 판정한다.
 *
 * Blob 저장소는 하나뿐이고 그 안에 **서명된 계약서 PDF**(`contracts/…`)가 있다. 이 이미지
 * 라우트도 소셜 미디어 라우트(lib/social/mediaPath.ts)와 마찬가지로 인증이 없으므로(검색
 * 엔진·카카오 미리보기가 가져가야 한다), 여기서 걸러지지 않은 입력은 계약서 유출로 이어진다.
 * 그래서 이 함수는 "안전한 것만 통과"로 짠다 — 세그먼트 하나, 파일명 문자만, 확장자
 * .webp, 그리고 접두사는 호출자가 아니라 이 함수가 붙인다.
 */
const FILENAME = /^[A-Za-z0-9._-]+$/;

export const FUNDING_MEDIA_PREFIX = 'funding/';

/**
 * 개설자 업로드 이미지가 이 도메인에서 노출되는 공개 주소의 접두사.
 *
 * `creatorUpload.ts`(주소를 만드는 쪽)와 `creatorValidation.ts`(개설자가 보낸 coverUrl·
 * imageUrl이 실제로 우리 업로드 경로에서 왔는지 확인하는 쪽)가 이 상수 하나를 같이 쓴다.
 * 손으로 문자열을 다시 적으면 정본이 둘이 되어, 한쪽만 바뀌었을 때 가드가 조용히
 * 무력화된다.
 */
export const FUNDING_MEDIA_URL_PREFIX = '/api/funding/media/';

/** 통과하면 Blob pathname, 아니면 null. */
export function resolveFundingBlobPath(input: string | string[] | undefined): string | null {
  const segments = ([] as string[]).concat(input ?? []);
  if (segments.length !== 1) return null;

  const [name] = segments;
  if (!name || name.length > 128) return null;
  if (!FILENAME.test(name)) return null;
  // 파일명 문자만 허용하므로 여기 닿을 수 없지만, 규칙이 느슨해질 때를 대비해 남긴다.
  if (name.startsWith('.') || name.includes('..')) return null;
  if (!name.toLowerCase().endsWith('.webp')) return null;

  return `${FUNDING_MEDIA_PREFIX}${name}`;
}

/**
 * 이 주소가 개설자 업로드 이미지인가 — `next/image` 최적화를 건너뛸지 판정한다.
 *
 * 최적화를 타면 브라우저가 아니라 **서버**가 `/_next/image`에서 원본을 가져온다. 그 요청에는
 * 쿠키가 실리지 않으므로, 승인 전 프로젝트의 이미지는 미디어 라우트의 접근 판정에서 404가
 * 된다(개설자 미리보기·관리자 심사 화면이 통째로 깨진다). 최적화기에 예외를 두는 것은
 * 접근 게이트를 우회하는 공개 경로를 하나 더 만드는 것이라 답이 아니다 — 브라우저가 직접,
 * 쿠키를 싣고 가져오게 한다.
 *
 * 승인된(공개) 이미지도 같은 경로를 탄다. 업로드 시점에 이미 가로 1600px 이하 webp로
 * 재인코딩되어 있어(`creatorUpload.ts`) 최적화기가 더 줄일 여지가 크지 않고, 판정에 따라
 * 렌더 방식이 갈리면 승인 직후 화면이 달라지는 자리가 생긴다.
 */
export const isFundingMediaUrl = (src: string | undefined): boolean =>
  typeof src === 'string' && src.startsWith(FUNDING_MEDIA_URL_PREFIX);
