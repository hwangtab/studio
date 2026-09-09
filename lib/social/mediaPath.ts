/**
 * 공개 이미지 라우트가 받아도 되는 경로인지 판정한다.
 *
 * Blob 저장소는 하나뿐이고 그 안에 **서명된 계약서 PDF**(`contracts/…`)가 있다. 소셜
 * 이미지를 내보내는 라우트는 인증이 없으므로, 여기서 걸러지지 않은 입력은 계약서 유출로
 * 이어진다. 그래서 이 함수는 "안전한 것만 통과"로 짠다 — 세그먼트 하나, 파일명 문자만,
 * 확장자 .jpg, 그리고 접두사는 호출자가 아니라 이 함수가 붙인다.
 */
const FILENAME = /^[A-Za-z0-9._-]+$/;

export const SOCIAL_PREFIX = 'social/';

/** 통과하면 Blob pathname, 아니면 null. */
export function resolveSocialBlobPath(input: string | string[] | undefined): string | null {
  const segments = ([] as string[]).concat(input ?? []);
  if (segments.length !== 1) return null;

  const [name] = segments;
  if (!name || name.length > 128) return null;
  if (!FILENAME.test(name)) return null;
  // 파일명 문자만 허용하므로 여기 닿을 수 없지만, 규칙이 느슨해질 때를 대비해 남긴다.
  if (name.startsWith('.') || name.includes('..')) return null;
  if (!name.toLowerCase().endsWith('.jpg')) return null;

  return `${SOCIAL_PREFIX}${name}`;
}
