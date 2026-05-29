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

const SingleReleasePage: NextPageWithLayout<Props> = ({ locale, portfolioItems, categories }) => (
  <TierPage locale={locale} tier="single" portfolioItems={portfolioItems} categories={categories} />
);

SingleReleasePage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const allItems = getPortfolioItems(locale);
  // productionNotes는 7개 언어 전체가 포함되어 __NEXT_DATA__가 과대해짐. 현재 locale 노트만 포함.
  // JSON round-trip으로 모든 undefined 키 제거 (Next.js getStaticProps는 undefined 직렬화 불가)
  const portfolioItems = JSON.parse(
    JSON.stringify(
      allItems.map((item) => {
        const note = item.productionNotes?.[locale];
        const { productionNotes: _omit, ...rest } = item;
        return note ? { ...rest, productionNotes: { [locale]: note } } : rest;
      })
    )
  ) as PortfolioItem[];
  const categories = getCategories(locale);

  return buildPageStaticProps(locale, { locale, portfolioItems, categories }, { revalidate: 86400 });
};

export default SingleReleasePage;
