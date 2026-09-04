/**
 * llms.txt·llms-full.txt 응답 크기 상한.
 *
 * Vercel 응답 한도(6MB)에 버퍼를 두고 5MB로 자른다. 두 가지를 바이트 기준으로 해야 한다.
 *
 * 1. 길이가 아니라 **바이트**로 잰다. `String.length`는 UTF-16 코드유닛 수라 한글 1글자를
 *    1로 세지만 UTF-8 인코딩은 3바이트다. 이 파일들의 내용은 한글 위주(스토리 제목·요약·
 *    지역명)라, "5MB 문자"가 실제로는 최대 15MB 바이트가 될 수 있었다 — 한도 버퍼라는
 *    안전판이 정작 필요한 순간에 무력해진다.
 *
 * 2. 자르는 지점을 **줄 경계**로 맞춘다. 단순 slice는 마크다운 리스트 항목이나
 *    `[제목](url)` 링크 한가운데를 끊어, 소비자(LLM 크롤러)가 깨진 링크를 읽게 된다.
 *
 * 현재 실측(ko 단독 llms-full 약 765KB)으로는 캡이 발동하지 않는다. 콘텐츠가 계속 늘어
 * 실제로 걸리는 날 위 두 결함이 동시에 드러나므로 미리 고쳐 둔다.
 */
export const LLMS_MAX_BODY_BYTES = 5 * 1024 * 1024;

const TRUNCATION_NOTICE = '\n... (truncated)';

export interface TruncateResult {
  body: string;
  /** 잘렸으면 원본 바이트 수. 안 잘렸으면 null — 호출부가 로그를 남길지 판단한다. */
  truncatedFromBytes: number | null;
}

/**
 * UTF-8 바이트 상한에 맞춰 자르되, 마지막 완전한 줄까지만 남긴다.
 * 안내 문구(`... (truncated)`)까지 포함해 상한을 넘지 않는다.
 */
export const truncateToByteLimit = (
  body: string,
  maxBytes: number = LLMS_MAX_BODY_BYTES,
): TruncateResult => {
  const totalBytes = Buffer.byteLength(body, 'utf8');
  if (totalBytes <= maxBytes) {
    return { body, truncatedFromBytes: null };
  }

  // 안내 문구가 들어갈 자리를 미리 뺀다.
  const budget = maxBytes - Buffer.byteLength(TRUNCATION_NOTICE, 'utf8');

  // Buffer로 잘라 낸 뒤 문자열로 되돌린다. 멀티바이트 문자 중간에서 잘리면 그 자리에
  // U+FFFD(치환 문자)가 생기므로 먼저 그것을 떨어뜨리고, 그다음 마지막 개행까지만 취해
  // 줄 경계로 맞춘다. 개행이 없는 한 줄짜리 본문에서는 줄 경계 폴백이 없으므로 U+FFFD
  // 제거가 유일한 방어다 — 둘을 각각 해야 하는 이유다.
  const sliced = Buffer.from(body, 'utf8')
    .subarray(0, Math.max(budget, 0))
    .toString('utf8')
    .replace(/�+$/, '');

  const lastNewline = sliced.lastIndexOf('\n');
  const kept = lastNewline > 0 ? sliced.slice(0, lastNewline) : sliced;

  return { body: kept + TRUNCATION_NOTICE, truncatedFromBytes: totalBytes };
};
