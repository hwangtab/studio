/** @jest-environment node */

import {
  extractAutoExpandBlock,
  computeThinContentStatus,
  getRelatedStories,
  getStoryAvailableLocales,
  getStoryPaths,
  THIN_CONTENT_THRESHOLD,
  SHORTCODE_CHAR_ESTIMATES,
} from './stories';

describe('extractAutoExpandBlock', () => {
  it('returns the source unchanged when no AUTO-EXPAND markers are present', () => {
    const src = '## Heading\n\nNormal body content.';
    const { stripped, block } = extractAutoExpandBlock(src);
    expect(stripped).toBe(src);
    expect(block).toBeNull();
  });

  it('strips a single AUTO-EXPAND block from the body and returns the inner text as block', () => {
    const src = [
      'lead paragraph',
      '<!-- AUTO-EXPAND-V1 -->',
      'common visit info',
      '<!-- /AUTO-EXPAND-V1 -->',
      'closing line',
    ].join('\n\n');

    const { stripped, block } = extractAutoExpandBlock(src);
    expect(stripped).not.toContain('AUTO-EXPAND');
    expect(stripped).toContain('lead paragraph');
    expect(stripped).toContain('closing line');
    expect(block).toBe('common visit info');
  });

  it('joins multiple AUTO-EXPAND blocks into a single block string', () => {
    const src = [
      'A',
      '<!-- AUTO-EXPAND-V1 -->',
      'first',
      '<!-- /AUTO-EXPAND-V1 -->',
      'B',
      '<!-- AUTO-EXPAND-V1 -->',
      'second',
      '<!-- /AUTO-EXPAND-V1 -->',
      'C',
    ].join('\n\n');

    const { stripped, block } = extractAutoExpandBlock(src);
    expect(stripped).not.toContain('AUTO-EXPAND');
    expect(stripped).toContain('A');
    expect(stripped).toContain('B');
    expect(stripped).toContain('C');
    expect(block).toContain('first');
    expect(block).toContain('second');
  });
});

describe('computeThinContentStatus', () => {
  it('flags content shorter than the threshold as thin', () => {
    const shortContent = 'short body'; // < 1500 chars
    const { isThinContent, charCount } = computeThinContentStatus(shortContent, 'some-slug');
    expect(isThinContent).toBe(true);
    expect(charCount).toBeLessThan(THIN_CONTENT_THRESHOLD);
  });

  it('does not flag content above the threshold as thin', () => {
    const longContent = 'a'.repeat(THIN_CONTENT_THRESHOLD + 100);
    const { isThinContent, charCount } = computeThinContentStatus(longContent, 'some-slug');
    expect(isThinContent).toBe(false);
    expect(charCount).toBeGreaterThanOrEqual(THIN_CONTENT_THRESHOLD);
  });

  it('counts non-whitespace characters only', () => {
    const padded = `${' '.repeat(2000)}body${'\n'.repeat(2000)}`;
    const { charCount } = computeThinContentStatus(padded, 'some-slug');
    expect(charCount).toBe('body'.length);
  });

  it('adds the configured bonus for known shortcodes', () => {
    const sessionBonus = SHORTCODE_CHAR_ESTIMATES['session-checklist'];
    const { charCount } = computeThinContentStatus('hi %%session-checklist%%', 'some-slug');
    // 'hi' (2 non-whitespace) + session-checklist literal length (excluding the %% wrapping)
    // is dominated by the bonus, so the total must be at least bonus + literal content count.
    expect(charCount).toBeGreaterThanOrEqual(sessionBonus);
  });

  it('falls back to a default bonus for unknown shortcodes', () => {
    const { charCount: withUnknown } = computeThinContentStatus(
      `${'a'.repeat(100)} %%unknown-shortcode%%`,
      'some-slug',
    );
    const { charCount: withoutShortcode } = computeThinContentStatus(
      'a'.repeat(100),
      'some-slug',
    );
    // The unknown shortcode raises the count above the no-shortcode baseline.
    expect(withUnknown).toBeGreaterThan(withoutShortcode);
  });

  it('exempts region hub slugs from the thin gate even with empty content', () => {
    // seoul1 is one of the documented region hub slugs in lib/regionHubSlugs.
    const { isThinContent } = computeThinContentStatus('', 'seoul1');
    expect(isThinContent).toBe(false);
  });

  it('still flags non-hub slugs with empty content as thin', () => {
    const { isThinContent } = computeThinContentStatus('', 'arbitrary-slug-no-hub');
    expect(isThinContent).toBe(true);
  });
});

describe('getStoryPaths', () => {
  it('does not pre-render default-locale paths for locale-only stories', () => {
    const paths = getStoryPaths();

    expect(paths).toContainEqual({
      params: { locale: 'en', id: 'korean-practice-room-booking-english' },
    });
    expect(paths).not.toContainEqual({
      params: { locale: 'ko', id: 'korean-practice-room-booking-english' },
    });
  });
});

describe('getRelatedStories', () => {
  it('does not recommend noindex or runtime-thin stories from an indexable page', () => {
    const related = getRelatedStories('ko', 'seoul1', 6);

    expect(related).toHaveLength(6);
    expect(related.map((story) => story.slug)).not.toEqual(
      expect.arrayContaining(['gwangju1', 'jeju1', 'sejong1', 'ulsan1'])
    );
    expect(
      related.every((story) => getStoryAvailableLocales(story.slug).includes('ko'))
    ).toBe(true);
  });
});
