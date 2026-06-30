import {
  buildPricingPageSchema,
  getPricingSchemaPriceValidUntil,
  normalizePricingSchemaOffers,
  type PricingSchemaData,
} from './pricingSchema';

const pricingData: PricingSchemaData = {
  specialPackages: [
    {
      id: 'package-demo',
      title: 'Demo Package',
      description: 'Demo package description',
      priceDisplay: '350,000원',
      priceValue: 350000,
      unit: '/ package',
      features: ['Recording', 'Mixing'],
      recommended: true,
    },
  ],
  recordingOffers: [],
  mixingOffers: [],
  masteringOffers: [],
  additionalServices: [
    {
      id: 'service-consulting',
      title: 'Consulting',
      description: 'Consulting description',
      priceDisplay: '문의',
      priceValue: 0,
      note: 'Discuss the project first.',
    },
  ],
};

const t = (key: string) => ({
  'common.siteName': 'Studio NOL',
  'pricing.seo.schemaTitle': 'Studio NOL Pricing Catalog',
  'pricing.seo.title': 'Pricing',
  'pricing.special.title': 'Special Packages',
  'pricing.recording.title': 'Recording',
  'pricing.mixing.title': 'Mixing',
  'pricing.mastering.title': 'Mastering',
  'pricing.additional.title': 'Additional Services',
}[key] ?? key);

describe('getPricingSchemaPriceValidUntil', () => {
  it('sets price validity 12 months ahead of the build date', () => {
    expect(getPricingSchemaPriceValidUntil(new Date('2026-06-30T12:00:00.000Z'))).toBe('2027-06-30');
  });
});

describe('normalizePricingSchemaOffers', () => {
  it('keeps paid offers and converts additional service notes into features', () => {
    const offers = normalizePricingSchemaOffers(pricingData);

    expect(offers.map((offer) => offer.id)).toEqual(['package-demo', 'service-consulting']);
    expect(offers[1]).toMatchObject({
      id: 'service-consulting',
      description: 'Discuss the project first.',
      features: ['Discuss the project first.'],
      priceValue: 0,
      unit: '',
    });
  });
});

describe('buildPricingPageSchema', () => {
  it('builds aggregate and catalog schema without treating unknown prices as free', () => {
    const schema = buildPricingPageSchema({
      locale: 'ko',
      siteUrl: 'https://studionol.co.kr',
      pricingData,
      t,
      priceValidUntil: '2027-06-30',
    });

    const graph = schema['@graph'] as Record<string, unknown>[];
    const offerCatalog = graph[1] as { itemListElement: Array<{ name: string; itemListElement: Record<string, unknown>[] }> };
    expect(graph[0]).toMatchObject({
      '@type': 'Product',
      name: 'Studio NOL Pricing Catalog',
    });
    expect(offerCatalog.itemListElement.map((catalog) => catalog.name)).toEqual([
      'Special Packages',
      'Recording',
      'Mixing',
      'Mastering',
      'Additional Services',
    ]);

    const paidOffer = offerCatalog.itemListElement[0].itemListElement[0];
    expect(paidOffer).toMatchObject({
      '@type': 'Offer',
      name: 'Demo Package',
      price: 350000,
      priceValidUntil: '2027-06-30',
    });

    const additionalOffer = offerCatalog.itemListElement[4].itemListElement[0];
    expect(additionalOffer).toMatchObject({
      '@type': 'Offer',
      name: 'Consulting',
      description: 'Discuss the project first.',
    });
    expect(additionalOffer).not.toHaveProperty('price');
  });
});
