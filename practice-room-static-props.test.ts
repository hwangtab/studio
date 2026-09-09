/** @jest-environment node */

import { getStaticProps } from './pages/[locale]/practice-room';

describe('practice-room static props', () => {
  it('no longer round-trips related guide data through props', async () => {
    const result = await getStaticProps({ params: { locale: 'ko' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const props = result.props as Record<string, unknown>;
    const legacyRelatedGuidePropNames = [
      'relatedGuides',
      ['relatedGuides', 'Visible', 'Html'].join(''),
      ['relatedGuides', 'Hidden', 'Html'].join(''),
      ['relatedGuides', 'Hidden', 'Count'].join(''),
    ];
    legacyRelatedGuidePropNames.forEach((propName) => {
      expect(props[propName]).toBeUndefined();
    });

    // 남는 것은 locale + i18nResources뿐이다. 임계값은 i18n 페이로드(약 9.8KB) 위에
    // 여유를 둔 값 — relatedGuides(약 52KB)가 되돌아오면 즉시 넘긴다.
    expect(Object.keys(props).sort()).toEqual(['i18nResources', 'locale']);
    expect(JSON.stringify(props).length).toBeLessThan(20_000);
  });

  it('serializes the same (small) props shape for non-Korean locales', async () => {
    const result = await getStaticProps({ params: { locale: 'en' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const props = result.props as Record<string, unknown>;
    expect(props.relatedGuides).toBeUndefined();
  });
});
