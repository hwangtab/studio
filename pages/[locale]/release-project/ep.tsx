import type { GetStaticPaths, GetStaticProps } from 'next';
import { TierPage } from '../../../components/release/TierPage';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getPortfolioItems, getCategories } from '../../../data/portfolio';
import type { PortfolioItem, PortfolioCategory } from '../../../types/data';
import type { NextPageWithLayout } from '../../../types';

interface Props {
  locale: Locale;
  portfolioItems: PortfolioItem[];
  categories: PortfolioCategory[];
}

const EpReleasePage: NextPageWithLayout<Props> = ({ locale, portfolioItems, categories }) => (
  <TierPage locale={locale} tier="ep" portfolioItems={portfolioItems} categories={categories} />
);

EpReleasePage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const allItems = getPortfolioItems(locale);
  // 모달이 필요한 작품만 전달 (디스코그래피 featured.slice(0,12))
  const relevantItems = allItems.filter((i) => i.featured).slice(0, 12);
  const portfolioItems = JSON.parse(
    JSON.stringify(
      relevantItems.map((item) => {
        const note = item.productionNotes?.[locale];
        const { productionNotes: _omit, ...rest } = item;
        return note ? { ...rest, productionNotes: { [locale]: note } } : rest;
      })
    )
  ) as PortfolioItem[];
  const categories = getCategories(locale);

  return buildPageStaticProps(locale, { locale, portfolioItems, categories }, { revalidate: 86400 });
};

export default EpReleasePage;
