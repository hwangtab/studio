/** @jest-environment node */

import { getStaticProps } from './pages/[locale]/practice-room';
import { PRACTICE_ROOM_RELATED_SLUGS } from './data/practiceRoomRelatedSlugs';

describe('practice-room static props', () => {
  it('serializes related guides as compact data instead of large HTML strings', async () => {
    const result = await getStaticProps({ params: { locale: 'ko' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const props = result.props as Record<string, unknown>;
    const legacyRelatedGuidePropNames = [
      ['relatedGuides', 'Visible', 'Html'].join(''),
      ['relatedGuides', 'Hidden', 'Html'].join(''),
      ['relatedGuides', 'Hidden', 'Count'].join(''),
    ];
    legacyRelatedGuidePropNames.forEach((propName) => {
      expect(props[propName]).toBeUndefined();
    });

    const relatedGuides = props.relatedGuides as Array<{ slug: string; title: string }>;
    expect(relatedGuides).toHaveLength(PRACTICE_ROOM_RELATED_SLUGS.length);
    expect(relatedGuides[0]).toEqual({
      slug: PRACTICE_ROOM_RELATED_SLUGS[0],
      title: expect.any(String),
    });
    expect(JSON.stringify(props).length).toBeLessThan(128_000);
  });

  it('omits related guide data for non-Korean practice-room pages', async () => {
    const result = await getStaticProps({ params: { locale: 'en' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const props = result.props as Record<string, unknown>;
    expect(props.relatedGuides).toEqual([]);
  });
});
