import { locales } from './i18n';

export const getCommonStaticPaths = async () => {
  return {
    paths: locales.map((locale) => ({ params: { locale } })),
    fallback: false,
  };
};

export const getCommonStaticProps = async ({ params }: any) => {
  const locale = params?.locale || 'ko';
  return {
    props: {
      locale,
    },
  };
};
