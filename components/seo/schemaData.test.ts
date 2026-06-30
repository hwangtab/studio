import { buildFinalSchemaData, collectSchemaItems, serializeJsonLd } from './schemaData';

describe('collectSchemaItems', () => {
  it('flattens arrays and @graph objects while ignoring empty inputs', () => {
    const items = collectSchemaItems([
      null,
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Studio NOL' },
      {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: 'Page' },
          { '@type': 'BreadcrumbList', itemListElement: [] },
        ],
      },
    ]);

    expect(items).toEqual([
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Studio NOL' },
      { '@type': 'WebPage', name: 'Page' },
      { '@type': 'BreadcrumbList', itemListElement: [] },
    ]);
  });
});

describe('buildFinalSchemaData', () => {
  it('returns null when schema output is disabled', () => {
    expect(
      buildFinalSchemaData({
        includeSchema: false,
        schemaItems: [{ '@type': 'WebSite' }],
      })
    ).toBeNull();
  });

  it('strips duplicate @context values when composing a graph with extras', () => {
    const result = buildFinalSchemaData({
      includeSchema: true,
      schemaItems: [
        { '@context': 'https://schema.org', '@type': 'WebSite' },
        { '@context': 'https://schema.org', '@type': 'WebPage' },
      ],
      breadcrumbSchema: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
      },
      faqSchema: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
      },
    });

    expect(result).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite' },
        { '@type': 'WebPage' },
        { '@type': 'BreadcrumbList' },
        { '@type': 'FAQPage' },
      ],
    });
  });
});

describe('serializeJsonLd', () => {
  it('escapes closing script tags inside JSON-LD payloads', () => {
    expect(serializeJsonLd({ name: '</script><p>bad</p>' })).toBe(
      '{"name":"<\\/script><p>bad<\\/p>"}'
    );
  });
});
