import { summarizeContent, stripMarkdown, extractFirstImageUrl } from './localDataUtils';

describe('localDataUtils helpers', () => {
  it('strips markdown syntax from content', () => {
    const markdown = '**굵게** 텍스트와 [링크](https://example.com)';
    expect(stripMarkdown(markdown)).toBe('굵게 텍스트와 링크');
  });

  it('summarizes lengthy content with ellipsis', () => {
    const text = 'a '.repeat(200);
    const summary = summarizeContent(text, 50);
    expect(summary.endsWith('...')).toBe(true);
    expect(summary.length).toBeGreaterThan(0);
  });

  it('extracts the first image url from markdown', () => {
    const markdown = '![](https://example.com/image.jpg) more text';
    expect(extractFirstImageUrl(markdown)).toBe('https://example.com/image.jpg');
  });
});
