import type { GetStaticPaths, GetStaticProps } from 'next';
import StoriesCollectionPage from '../../../../../../components/stories/StoriesCollectionPage';
import {
  STORIES_PAGE_SIZE,
  getStoriesPage,
  type StoriesPageData,
} from '../../../../../../lib/stories';
import { buildPageStaticProps, resolveLocaleParam } from '../../../../../../lib/getStatic';
import { locales, type Locale } from '../../../../../../lib/i18n';
import type { NextPageWithLayout } from '../../../../../../types';

interface StoriesCategoryPaginatedPageProps extends StoriesPageData {
  locale: Locale;
}

const StoriesCategoryPaginatedPage: NextPageWithLayout<StoriesCategoryPaginatedPageProps> = ({
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

StoriesCategoryPaginatedPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = locales.flatMap((locale) => {
    const basePageData = getStoriesPage(locale, null, 1, STORIES_PAGE_SIZE);
    const categories = basePageData?.availableCategories ?? [];

    return categories.flatMap((category) => {
      const categoryPageData = getStoriesPage(locale, category, 1, STORIES_PAGE_SIZE);
      const totalPages = categoryPageData?.totalPages ?? 1;

      return Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => ({
        params: {
          locale,
          category,
          page: String(index + 2),
        },
      }));
    });
  });

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<StoriesCategoryPaginatedPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const category = params?.category as string;
  const page = Number(params?.page);
  const pageData = getStoriesPage(locale, category, page, STORIES_PAGE_SIZE);

  if (!pageData || page <= 1) {
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

export default StoriesCategoryPaginatedPage;
