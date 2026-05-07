import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';

import BuyerIntentHubPage from '../../../components/guides/BuyerIntentHubPage';
import {
  buyerIntentHubs,
  buyerIntentHubSlugs,
  type BuyerIntentHubSlug,
} from '../../../data/buyerIntentHubs';
import { getPricingData } from '../../../data/pricing';
import { getPortfolioItems } from '../../../data/portfolio';
import { getAllStories } from '../../../lib/stories';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { defaultLocale, type Locale } from '../../../lib/i18n';
import type { StoryCardData } from '../../../types/story';
import type { PortfolioItem } from '../../../types/data';
import type { NextPageWithLayout } from '../../../types';

type AnyPackage = ReturnType<typeof getPricingData>['specialPackages'][number]
  | ReturnType<typeof getPricingData>['recordingOffers'][number]
  | ReturnType<typeof getPricingData>['mixingOffers'][number];

interface BuyerIntentHubPageProps {
  locale: Locale;
  hub: typeof buyerIntentHubs[BuyerIntentHubSlug];
  relatedStories: StoryCardData[];
  relatedPortfolio: PortfolioItem[];
  primaryPackage: AnyPackage | null;
  secondaryPackage: AnyPackage | null;
}

const findPackageById = (
  pricingData: ReturnType<typeof getPricingData>,
  id: string | undefined
): AnyPackage | null => {
  if (!id) return null;
  const pools: AnyPackage[][] = [
    [...pricingData.specialPackages],
    [...pricingData.recordingOffers],
    [...pricingData.mixingOffers],
  ];
  for (const pool of pools) {
    const found = pool.find((p) => p.id === id);
    if (found) return found;
  }
  return null;
};

const BuyerIntentHubRoute: NextPageWithLayout<BuyerIntentHubPageProps> = ({
  hub,
  locale,
  relatedStories,
  relatedPortfolio,
  primaryPackage,
  secondaryPackage,
}) => (
  <BuyerIntentHubPage
    hub={hub}
    locale={locale}
    relatedStories={relatedStories}
    relatedPortfolio={relatedPortfolio}
    primaryPackage={primaryPackage}
    secondaryPackage={secondaryPackage}
  />
);

BuyerIntentHubRoute.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  // Buyer-intent hub은 한국어 콘텐츠만 큐레이션돼 있어 ko에서만 SSG한다.
  // 다른 locale에서 직접 URL 접근 시 404 — ko fallback 페이지를 만들고 noindex
  // 처리하는 방식보다 sitemap·hreflang 시그널이 더 깔끔하다 (sitemap에 noindex
  // URL이 들어가는 것을 방지). 번역 콘텐츠가 추가되면 해당 locale을 paths에 합류.
  const paths = buyerIntentHubSlugs.map((slug) => ({
    params: { locale: defaultLocale, slug },
  }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<BuyerIntentHubPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const slug = params?.slug as BuyerIntentHubSlug | undefined;
  if (!slug || !buyerIntentHubs[slug]) {
    return { notFound: true };
  }
  const hub = buyerIntentHubs[slug];

  // 큐레이션된 6 slug → StoryCardData 경량 매핑.
  const allStories = getAllStories(locale);
  const bySlug = new Map(allStories.map((s) => [s.slug, s]));
  const relatedStories: StoryCardData[] = hub.relatedStorySlugs
    .map((s) => bySlug.get(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      date: s.date,
      categoryKey: s.categoryKey,
      thumbnail: s.thumbnail,
      summary: s.summary,
    }));

  // Portfolio 매칭 — 카테고리 'all'이면 featured 우선 셔플 없이 처음 3개.
  const allPortfolio = getPortfolioItems(locale);
  const filtered = hub.portfolioCategory === 'all'
    ? allPortfolio
    : allPortfolio.filter((item) => item.category === hub.portfolioCategory);
  const featured = filtered.filter((item) => item.featured);
  const fallback = filtered.filter((item) => !item.featured);
  const relatedPortfolio = [...featured, ...fallback].slice(0, 3);

  // Pricing 패키지 lookup. 매핑 실패(또는 빈 ID — lesson처럼 pricing 데이터에
  // entry가 없는 경우)면 hub.pricingFallback을 primary로 사용한다.
  const pricingData = getPricingData(locale);
  const lookedUpPrimary = findPackageById(pricingData, hub.pricingPackageId);
  const primaryPackage: AnyPackage | null =
    lookedUpPrimary
    ?? (hub.pricingFallback
      ? {
          id: hub.pricingFallback.id,
          title: hub.pricingFallback.title,
          priceDisplay: hub.pricingFallback.priceDisplay,
          priceValue: 0,
          unit: hub.pricingFallback.unit ?? '',
          description: hub.pricingFallback.description,
          features: [...hub.pricingFallback.features],
          ...(hub.pricingFallback.recommended && { recommended: hub.pricingFallback.recommended }),
        } as AnyPackage
      : null);
  const secondaryPackage = hub.secondaryPricingPackageId
    ? findPackageById(pricingData, hub.secondaryPricingPackageId)
    : null;

  return buildPageStaticProps(
    locale,
    {
      hub,
      relatedStories,
      relatedPortfolio,
      primaryPackage,
      secondaryPackage,
    },
    { revalidate: 86400, i18nSections: ['stories'] }
  );
};

export default BuyerIntentHubRoute;
