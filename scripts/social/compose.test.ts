/** @jest-environment node */
import {
  buildInstagramCaption,
  buildThreadsText,
  fallbackJpegUrl,
  storyUrl,
  toHashtags,
  THREADS_TEXT_LIMIT,
} from './compose.mjs';

describe('toHashtags', () => {
  it('strips spaces/punctuation, dedupes, caps count', () => {
    expect(toHashtags(['Ableton Live 보컬', 'ableton live 보컬', 'EQ-8', '', '!!'])).toEqual([
      '#AbletonLive보컬',
      '#EQ8',
    ]);
    expect(toHashtags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
  });
});

describe('buildThreadsText', () => {
  const long = { title: '제목', summary: '가나다 '.repeat(300), slug: 'ableton1', tags: ['a', 'b'] };
  it('stays within 500 chars and keeps the URL intact at the end', () => {
    const text = buildThreadsText(long);
    expect(text.length).toBeLessThanOrEqual(THREADS_TEXT_LIMIT);
    expect(text.endsWith(storyUrl('ableton1'))).toBe(true);
    expect(text).toContain('…');
  });
  it('does not truncate short posts', () => {
    const text = buildThreadsText({ title: 'T', summary: 'S', slug: 's', tags: [] });
    expect(text).toBe(`T\n\nS\n\n${storyUrl('s')}`);
  });
});

describe('buildInstagramCaption', () => {
  it('has no URL and includes hashtags', () => {
    const c = buildInstagramCaption({ title: 'T', summary: 'S', tags: ['믹싱 팁'] });
    expect(c).not.toMatch(/https?:/);
    expect(c).toContain('#믹싱팁');
    expect(c).toContain('프로필 링크');
  });
});

describe('fallbackJpegUrl', () => {
  it('maps webp thumbnail to the original jpg', () => {
    expect(fallbackJpegUrl('/images/service3.webp')).toBe('https://studionol.co.kr/images/service3.jpg');
  });
  it('rejects external or non-image paths', () => {
    expect(fallbackJpegUrl('https://x/y.webp')).toBeNull();
    expect(fallbackJpegUrl('/images/a.svg')).toBeNull();
    expect(fallbackJpegUrl(null)).toBeNull();
  });
});
