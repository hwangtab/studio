import type { GetStaticPaths, GetStaticProps } from 'next';
import { TierPage } from '../../../components/release/TierPage';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getPortfolioItems } from '../../../data/portfolio';
import type { PortfolioItem } from '../../../types/data';
import type { NextPageWithLayout } from '../../../types';

interface Props {
  locale: Locale;
  portfolioItems: Pick<PortfolioItem, 'id' | 'title' | 'description' | 'image' | 'artist' | 'featured'>[];
}

const AlbumReleasePage: NextPageWithLayout<Props> = ({ locale, portfolioItems }) => (
  <TierPage locale={locale} tier="album" portfolioItems={portfolioItems} inProgressItems={[]} />
);

AlbumReleasePage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const allItems = getPortfolioItems(locale);
  const portfolioItems = allItems
    .filter((item) => item.featured)
    .map(({ id, title, description, image, artist, featured }) => ({
      id, title, description, image, artist, featured,
    }));

  return buildPageStaticProps(locale, { locale, portfolioItems }, { revalidate: 86400 });
};

export default AlbumReleasePage;
