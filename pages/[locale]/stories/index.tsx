import type { GetStaticPaths, GetStaticProps } from 'next';
import StoriesCollectionPage from '../../../components/stories/StoriesCollectionPage';
import {
  STORIES_PAGE_SIZE,
  getStoriesPage,
  type StoriesPageData,
} from '../../../lib/stories';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import type { NextPageWithLayout } from '../../../types';

interface StoriesIndexPageProps extends StoriesPageData {
  locale: Locale;
}

const StoriesIndexPage: NextPageWithLayout<StoriesIndexPageProps> = ({
  locale,
  stories,
  availableCategories,
  activeCategory,
  activeTag,
  currentPage,
  totalPages,
}) => (
  <StoriesCollectionPage
    locale={locale}
    stories={stories}
    availableCategories={availableCategories}
    activeCategory={activeCategory}
    activeTag={activeTag}
    currentPage={currentPage}
    totalPages={totalPages}
  />
);

StoriesIndexPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<StoriesIndexPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pageData = getStoriesPage(locale, null, 1, STORIES_PAGE_SIZE);

  if (!pageData) {
    return {
      notFound: true,
    };
  }

  return buildPageStaticProps<StoriesPageData>(
    locale,
    pageData,
    { revalidate: 1800 }
  );
};

export default StoriesIndexPage;
