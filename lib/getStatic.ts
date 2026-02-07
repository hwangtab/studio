import type { GetStaticProps } from 'next';
import { locales } from './i18n';

export const getCommonStaticPaths = async () => {
  return {
    paths: locales.map((locale) => ({ params: { locale } })),
    fallback: false,
  };
};

export const getCommonStaticProps: GetStaticProps = async ({ params }) => {
  const locale = params?.locale || 'ko';
  return {
    props: {
      locale,
    },
  };
};
