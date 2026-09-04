/** @jest-environment node */

/**
 * llms.txt 응답 절단.
 *
 * 예전엔 `body.length`(UTF-16 코드유닛)로 재고 단순 slice로 잘랐다. 이 파일들의 내용은
 * 한글 위주라 "5MB 문자"가 실제로는 최대 15MB 바이트였고, 자르는 지점이 링크 한가운데일
 * 수 있었다. 두 성질을 고정한다.
 */
import { truncateToByteLimit } from './truncate';

describe('truncateToByteLimit', () => {
  it('상한 이내면 그대로 두고 잘랐다고 하지 않는다', () => {
    const body = '짧은 본문\n두 번째 줄';
    expect(truncateToByteLimit(body, 1000)).toEqual({ body, truncatedFromBytes: null });
  });

  /** 한글은 UTF-8에서 3바이트다. 길이로 재면 상한을 3배 과소평가한다. */
  it('길이가 아니라 UTF-8 바이트로 잰다', () => {
    const body = '가'.repeat(100); // 100자 = 300바이트
    expect(body.length).toBe(100);

    // 길이 기준이었다면 상한 200에 걸리지 않았을 것이다.
    const result = truncateToByteLimit(body, 200);
    expect(result.truncatedFromBytes).toBe(300);
    expect(Buffer.byteLength(result.body, 'utf8')).toBeLessThanOrEqual(200);
  });

  it('자른 결과가 상한을 넘지 않는다 (안내 문구 포함)', () => {
    const body = Array.from({ length: 500 }, (_, i) => `- [항목 ${i}](/ko/stories/item-${i})`).join('\n');
    const limit = 2000;
    const result = truncateToByteLimit(body, limit);

    expect(result.truncatedFromBytes).toBe(Buffer.byteLength(body, 'utf8'));
    expect(Buffer.byteLength(result.body, 'utf8')).toBeLessThanOrEqual(limit);
  });

  /** 마크다운 링크·리스트 항목 한가운데서 끊기면 소비자가 깨진 링크를 읽는다. */
  it('줄 경계에서 자른다 — 링크 중간에서 끊지 않는다', () => {
    const body = Array.from({ length: 200 }, (_, i) => `- [제목 ${i}](/ko/stories/slug-${i})`).join('\n');
    const result = truncateToByteLimit(body, 1000);

    const lines = result.body.split('\n');
    const notice = lines.pop(); // 마지막은 안내 문구
    expect(notice).toContain('truncated');
    // 남은 줄은 전부 완결된 링크 형태여야 한다.
    for (const line of lines) {
      expect(line).toMatch(/^- \[제목 \d+\]\(\/ko\/stories\/slug-\d+\)$/);
    }
  });

  it('잘린 본문에 안내 문구를 붙인다', () => {
    const result = truncateToByteLimit('가'.repeat(100), 200);
    expect(result.body).toContain('(truncated)');
  });

  /** 개행이 없는 한 줄짜리 거대 본문에서도 깨진 문자를 남기지 않는다. */
  it('개행이 없어도 깨진 멀티바이트 문자를 남기지 않는다', () => {
    const result = truncateToByteLimit('가'.repeat(100), 200);
    // 깨진 바이트가 남으면 U+FFFD(치환 문자)가 나타난다.
    expect(result.body).not.toContain('�');
  });
});
