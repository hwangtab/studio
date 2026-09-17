/**
 * `next.config.mjs`의 `images.remotePatterns`에 등록된 호스트 목록.
 *
 * `next.config.mjs`는 빌드 설정이라 컴포넌트(`MarkdownImage.tsx`)가 직접 import할 수
 * 없어 여기 상수로 따로 둔다. **두 목록은 반드시 같이 유지할 것** —
 * `allowedRemoteImageHosts.consistency.test.ts`가 `next.config.mjs` 소스를 파싱해
 * 이 배열과 대조하므로, 한쪽만 고치면 CI가 잡는다.
 *
 * 이 목록에 없는 호스트의 절대 URL을 `next/image`에 넘기면 렌더 중간에 throw한다 —
 * 펀딩 개설자가 본문 마크다운에 외부 이미지 주소를 붙여넣는 경로가 생기면서, 등록되지
 * 않은 호스트가 저장 시점이 아니라 렌더 시점에 처음 나타날 수 있게 됐다. `MarkdownImage`는
 * 이 목록 밖의 절대 URL을 평범한 `<img>`로 강등해서 그 경로를 막는다.
 */
export const ALLOWED_REMOTE_IMAGE_HOSTS: readonly string[] = [
  'image.bugsm.co.kr',
  'img.tumblbug.com',
  'is1-ssl.mzstatic.com',
  'thumb.mt.co.kr',
  'cdn.imweb.me',
  'i.ytimg.com',
  'www.news-art.co.kr',
];
