import type { Locale } from './i18n';
import { generateAggregateOfferSchema, getSchemaLanguage } from '../utils/schema';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export interface PricingSchemaOffer {
  id: string;
  title: string;
  description?: string;
  priceValue: number;
  priceDisplay?: string;
  unit?: string;
  features?: string[];
  recommended?: boolean;
}

export interface PricingSchemaAdditionalService {
  id: string;
  title: string;
  description?: string;
  priceDisplay: string;
  priceValue?: number;
  unit?: string;
  note?: string;
}

export interface PricingSchemaData {
  specialPackages: PricingSchemaOffer[];
  recordingOffers: PricingSchemaOffer[];
  mixingOffers: PricingSchemaOffer[];
  masteringOffers: PricingSchemaOffer[];
  additionalServices: PricingSchemaAdditionalService[];
}

interface BuildPricingPageSchemaOptions {
  locale: Locale;
  siteUrl: string;
  pricingData: PricingSchemaData;
  t: TranslateFn;
  priceValidUntil?: string;
}

interface PricingOfferSchemaContext {
  locale: Locale;
  pricingUrl: string;
  priceValidUntil: string;
  schemaLanguage: string;
  siteName: string;
  siteUrl: string;
}

export const getPricingSchemaPriceValidUntil = (baseDate = new Date()): string => {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + 12);
  return date.toISOString().split('T')[0];
};

export const normalizePricingSchemaOffers = (pricingData: PricingSchemaData): PricingSchemaOffer[] => [
  ...pricingData.specialPackages,
  ...pricingData.recordingOffers,
  ...pricingData.mixingOffers,
  ...pricingData.masteringOffers,
  ...pricingData.additionalServices.map((service) => ({
    id: service.id,
    title: service.title,
    description: service.note || service.description || '',
    priceValue: service.priceValue || 0,
    priceDisplay: service.priceDisplay,
    unit: service.unit || '',
    features: service.note ? [service.note] : [],
  })),
];

const buildPricingOfferSchema = (
  offer: PricingSchemaOffer,
  context: PricingOfferSchemaContext
) => ({
  '@type': 'Offer',
  name: offer.title,
  description: offer.description || '',
  inLanguage: context.schemaLanguage,
  priceCurrency: 'KRW',
  ...(offer.priceValue > 0 && { price: offer.priceValue }),
  priceValidUntil: context.priceValidUntil,
  availability: 'https://schema.org/InStock',
  url: `${context.pricingUrl}#${offer.id}`,
  seller: {
    '@type': 'Organization',
    name: context.siteName,
    '@id': `${context.siteUrl}/#organization`,
  },
  itemOffered: {
    '@type': 'Service',
    name: offer.title,
    url: `${context.pricingUrl}#${offer.id}`,
    inLanguage: context.schemaLanguage,
    areaServed: [
      { '@type': 'AdministrativeArea', name: context.locale === 'ko' ? '서울특별시' : 'Seoul' },
      { '@type': 'AdministrativeArea', name: context.locale === 'ko' ? '은평구' : 'Eunpyeong-gu' },
    ],
    provider: {
      '@type': 'Organization',
      '@id': `${context.siteUrl}/#organization`,
      name: context.siteName,
    },
  },
});

const buildPricingCatalogSchema = (
  name: string,
  offers: PricingSchemaOffer[],
  context: PricingOfferSchemaContext
) => ({
  '@type': 'OfferCatalog',
  name,
  inLanguage: context.schemaLanguage,
  itemListElement: offers.map((offer) => buildPricingOfferSchema(offer, context)),
});

export const buildPricingPageSchema = ({
  locale,
  siteUrl,
  pricingData,
  t,
  priceValidUntil = getPricingSchemaPriceValidUntil(),
}: BuildPricingPageSchemaOptions): Record<string, unknown> => {
  const schemaLanguage = getSchemaLanguage(locale);
  const pricingUrl = `${siteUrl}/${locale}/pricing`;
  const siteName = t('common.siteName');
  const context: PricingOfferSchemaContext = {
    locale,
    pricingUrl,
    priceValidUntil,
    schemaLanguage,
    siteName,
    siteUrl,
  };
  const allOffers = normalizePricingSchemaOffers(pricingData);
  const aggregateOfferSchema = generateAggregateOfferSchema(
    t('pricing.seo.schemaTitle'),
    allOffers.map((offer) => ({ name: offer.title, priceValue: offer.priceValue })),
    locale
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [
      aggregateOfferSchema,
      {
        '@type': 'OfferCatalog',
        name: t('pricing.seo.title'),
        inLanguage: schemaLanguage,
        itemListElement: [
          buildPricingCatalogSchema(t('pricing.special.title'), pricingData.specialPackages, context),
          buildPricingCatalogSchema(t('pricing.recording.title'), pricingData.recordingOffers, context),
          buildPricingCatalogSchema(t('pricing.mixing.title'), pricingData.mixingOffers, context),
          buildPricingCatalogSchema(t('pricing.mastering.title'), pricingData.masteringOffers, context),
          buildPricingCatalogSchema(
            t('pricing.additional.title'),
            normalizePricingSchemaOffers({
              specialPackages: [],
              recordingOffers: [],
              mixingOffers: [],
              masteringOffers: [],
              additionalServices: pricingData.additionalServices,
            }),
            context
          ),
        ],
      },
    ].filter(Boolean) as Record<string, unknown>[],
  };
};
