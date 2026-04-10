import type { GetStaticPaths, GetStaticProps } from 'next';
import StoriesCollectionPage from '../../../../components/stories/StoriesCollectionPage';
import {
  STORIES_PAGE_SIZE,
  getStoriesPage,
  getAllTags,
  type StoriesPageData,
} from '../../../../lib/stories';
import { buildPageStaticProps, resolveLocaleParam } from '../../../../lib/getStatic';
import { locales, type Locale } from '../../../../lib/i18n';
import type { NextPageWithLayout } from '../../../../types';

interface StoriesTagPageProps extends StoriesPageData {
  locale: Locale;
}

const StoriesTagPage: NextPageWithLayout<StoriesTagPageProps> = ({
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

StoriesTagPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = locales.flatMap((locale) => {
    const tags = getAllTags(locale);
    return tags.map((tag) => ({
      params: {
        locale,
        tag,
      },
    }));
  });

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<StoriesTagPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const tag = decodeURIComponent(params?.tag as string);
  const pageData = getStoriesPage(locale, null, 1, STORIES_PAGE_SIZE, tag);

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

export default StoriesTagPage;
