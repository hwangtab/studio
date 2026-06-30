/** @jest-environment node */

import {
  computeThinContentStatus,
  extractAutoExpandBlock,
  SHORTCODE_CHAR_ESTIMATES,
  THIN_CONTENT_THRESHOLD,
} from './storyContentPolicy';

describe('storyContentPolicy', () => {
  it('strips AUTO-EXPAND boilerplate while preserving editorial body', () => {
    const source = [
      'lead paragraph',
      '<!-- AUTO-EXPAND-V1 -->',
      'shared local visit copy',
      '<!-- /AUTO-EXPAND-V1 -->',
      'closing paragraph',
    ].join('\n\n');

    const { stripped, block } = extractAutoExpandBlock(source);

    expect(stripped).toContain('lead paragraph');
    expect(stripped).toContain('closing paragraph');
    expect(stripped).not.toContain('AUTO-EXPAND');
    expect(block).toBe('shared local visit copy');
  });

  it('uses the shared thin-content threshold and shortcode estimates', () => {
    const sessionBonus = SHORTCODE_CHAR_ESTIMATES['session-checklist'];
    const { isThinContent, charCount } = computeThinContentStatus(
      'hi %%session-checklist%%',
      'ordinary-slug',
    );

    expect(THIN_CONTENT_THRESHOLD).toBe(1500);
    expect(charCount).toBeGreaterThanOrEqual(sessionBonus);
    expect(isThinContent).toBe(true);
  });
});
