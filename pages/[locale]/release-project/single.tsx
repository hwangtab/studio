import type { GetStaticPaths, GetStaticProps } from 'next';
import { TierPage } from '../../../components/release/TierPage';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getPortfolioItems } from '../../../data/portfolio';
import type { PortfolioItem } from '../../../types/data';
import type { NextPageWithLayout } from '../../../types';

interface Props {
  locale: Locale;
  portfolioItems: Pick<PortfolioItem, 'id' | 'title' | 'description' | 'image' | 'artist' | 'featured' | 'category'>[];
}

const SingleReleasePage: NextPageWithLayout<Props> = ({ locale, portfolioItems }) => (
  <TierPage locale={locale} tier="single" portfolioItems={portfolioItems} />
);

SingleReleasePage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const allItems = getPortfolioItems(locale);
  const SINGLE_CASE_STUDY_IDS = ['tierliner-bite-me'];
  const portfolioItems = allItems
    .filter((item) => item.featured || SINGLE_CASE_STUDY_IDS.includes(item.id))
    .map(({ id, title, description, image, artist, featured, category }) => ({
      id, title, description, image, artist, featured, category,
    }));

  return buildPageStaticProps(locale, { locale, portfolioItems }, { revalidate: 86400 });
};

export default SingleReleasePage;
