import type { GetStaticPaths, GetStaticProps } from 'next';
import { TierPage } from '../../../components/release/TierPage';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getTierPortfolioItems, type TierPortfolioItem } from '../../../data/portfolio';
import type { NextPageWithLayout } from '../../../types';

interface Props {
  locale: Locale;
  portfolioItems: TierPortfolioItem[];
}

const AlbumReleasePage: NextPageWithLayout<Props> = ({ locale, portfolioItems }) => (
  <TierPage locale={locale} tier="album" portfolioItems={portfolioItems} />
);

AlbumReleasePage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const portfolioItems = getTierPortfolioItems(locale, 'album');

  return buildPageStaticProps(locale, { locale, portfolioItems }, { revalidate: 86400, i18nSections: ['releaseProject', 'portfolio'] });
};

export default AlbumReleasePage;
