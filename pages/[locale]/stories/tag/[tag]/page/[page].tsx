import type { GetStaticPaths, GetStaticProps } from 'next';
import StoriesCollectionPage from '../../../../../../components/stories/StoriesCollectionPage';
import {
  STORIES_PAGE_SIZE,
  getStoriesPage,
  getAllTags,
  type StoriesPageData,
} from '../../../../../../lib/stories';
import { buildPageStaticProps, resolveLocaleParam } from '../../../../../../lib/getStatic';
import { locales, type Locale } from '../../../../../../lib/i18n';
import type { NextPageWithLayout } from '../../../../../../types';

interface StoriesTagPaginatedPageProps extends StoriesPageData {
  locale: Locale;
}

const StoriesTagPaginatedPage: NextPageWithLayout<StoriesTagPaginatedPageProps> = ({
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

StoriesTagPaginatedPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = locales.flatMap((locale) => {
    const tags = getAllTags(locale);

    return tags.flatMap((tag) => {
      const tagPageData = getStoriesPage(locale, null, 1, STORIES_PAGE_SIZE, tag);
      const totalPages = tagPageData?.totalPages ?? 1;

      return Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => ({
        params: {
          locale,
          tag,
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

export const getStaticProps: GetStaticProps<StoriesTagPaginatedPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const tag = decodeURIComponent(params?.tag as string);
  const page = Number(params?.page);
  const pageData = getStoriesPage(locale, null, page, STORIES_PAGE_SIZE, tag);

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

export default StoriesTagPaginatedPage;
