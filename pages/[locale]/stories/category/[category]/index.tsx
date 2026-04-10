import type { GetStaticPaths, GetStaticProps } from 'next';
import StoriesCollectionPage from '../../../../../components/stories/StoriesCollectionPage';
import {
  STORIES_PAGE_SIZE,
  getStoriesPage,
  type StoriesPageData,
} from '../../../../../lib/stories';
import { buildPageStaticProps, resolveLocaleParam } from '../../../../../lib/getStatic';
import { locales, type Locale } from '../../../../../lib/i18n';
import type { NextPageWithLayout } from '../../../../../types';

interface StoriesCategoryPageProps extends StoriesPageData {
  locale: Locale;
}

const StoriesCategoryPage: NextPageWithLayout<StoriesCategoryPageProps> = ({
  locale,
  stories,
  availableCategories,
  activeCategory,
  currentPage,
  totalPages,
}) => (
  <StoriesCollectionPage
    locale={locale}
    stories={stories}
    availableCategories={availableCategories}
    activeCategory={activeCategory}
    currentPage={currentPage}
    totalPages={totalPages}
  />
);

StoriesCategoryPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = locales.flatMap((locale) => {
    const pageData = getStoriesPage(locale, null, 1, STORIES_PAGE_SIZE);
    const categories = pageData?.availableCategories ?? [];

    return categories.map((category) => ({
      params: {
        locale,
        category,
      },
    }));
  });

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<StoriesCategoryPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const category = params?.category as string;
  const pageData = getStoriesPage(locale, category, 1, STORIES_PAGE_SIZE);

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

export default StoriesCategoryPage;
