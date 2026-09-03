import { extractMarkdownHeadings } from './extractHeadings';
import { toHeadingId } from './headings';

describe('extractMarkdownHeadings', () => {
  it('extracts headings within the requested level range', () => {
    const content = '# Title\n## First\ncontent\n### Sub\n#### Skip\n';
    expect(extractMarkdownHeadings(content)).toEqual([
      { id: 'first', text: 'First', level: 2 },
      { id: 'sub', text: 'Sub', level: 3 },
    ]);
  });

  it('skips headings inside fenced code blocks', () => {
    const content = '## Real\n```\n## Fake\n```\n## AlsoReal\n';
    expect(extractMarkdownHeadings(content).map((h) => h.text)).toEqual(['Real', 'AlsoReal']);
  });

  it('decodes HTML entities so the TOC id matches the actual rendered heading id', () => {
    const content = '## Q&amp;A 세션\n';
    const [heading] = extractMarkdownHeadings(content);
    expect(heading.text).toBe('Q&A 세션');
    // MarkdownRenderer computes the real heading id from the rendered (already-decoded) text.
    expect(heading.id).toBe(toHeadingId('Q&A 세션'));
    expect(heading.id).toBe(toHeadingId(heading.text));
  });
});
