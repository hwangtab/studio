import type { GetStaticProps, NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import { Section } from '../components/ui/Section';
import { defaultLocale, locales, type Locale } from '../lib/i18n';
import { getAllLocalesI18nResourcesServer } from '../lib/i18n.server';

const NotFoundPage: NextPage = () => {
  const router = useRouter();

  const { locale } = useMemo(() => {
    const currentPath = router.asPath;
    const segments = currentPath.split('/');
    const potentialLocale = segments[1];
    const detectedLocale = locales.includes(potentialLocale as Locale)
      ? (potentialLocale as Locale)
      : defaultLocale;
    return { locale: detectedLocale };
  }, [router.asPath]);

  const { t } = useTranslation('common', { lng: locale });
  const pageContentMotionProps = PAGE_CONTENT_ANIMATION;

  return (
    <Section variant="default" className="min-h-[60vh] flex flex-col justify-center text-center">
      <SEO
        title={t('notFound.seoTitle')}
        description="404 Not Found"
        robots="noindex, nofollow, noarchive, nosnippet"
        disableCanonicalAndAlternates
        canonical="/404"
      />

      <m.div
        className="inline-flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-6 py-3 mb-6 typo-card-subtitle text-primary-dark dark:text-primary-light"
        {...PAGE_SUBTITLE_ANIMATION}
      >
        {t('notFound.badge')}
      </m.div>

      <m.h1
        className="text-heading-1 font-title mb-6"
        {...PAGE_TITLE_ANIMATION}
      >
        {t('notFound.title')}
      </m.h1>

      <m.p
        className="typo-section-lead max-w-2xl mx-auto mb-10 text-gray-600 dark:text-gray-300"
        {...pageContentMotionProps}
      >
        <>
          {t('notFound.messageLine1')}
          <br className="hidden sm:block" />
          {t('notFound.messageLine2')}
        </>
      </m.p>

      <m.div
        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
        {...pageContentMotionProps}
        transition={{ ...PAGE_CONTENT_ANIMATION.transition, delay: 0.6 }}
      >
        <Link
          href={`/${locale}`}
          className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors duration-300 typo-button shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
        >
          {t('notFound.goHome')}
        </Link>
        <Link
          href={`/${locale}/contact`}
          className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-full border border-primary text-primary hover:bg-primary/10 dark:border-primary-light dark:text-primary-light transition-colors duration-300 typo-button touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          {t('notFound.contact')}
        </Link>
      </m.div>
    </Section>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      i18nResources: getAllLocalesI18nResourcesServer(),
    },
    revalidate: 3600,
  };
};

export default NotFoundPage;
