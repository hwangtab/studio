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
        disableUrlMetaAndAlternates
        canonical="/404"
      />

      {/* badge를 h1(delay 0)보다 DOM에 먼저 두므로 진입 delay를 0으로 맞춰 (latent) 순서 역전 제거 */}
      <m.div
        className="inline-flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-6 py-3 mb-6 typo-card-subtitle text-primary-dark dark:text-primary-light"
        {...PAGE_SUBTITLE_ANIMATION}
        transition={{ ...PAGE_SUBTITLE_ANIMATION.transition, delay: 0 }}
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

      {/* 막다른 404에서 콘텐츠 많은 사이트의 인기 목적지로 회수 — 홈/문의 2택 보완. */}
      <m.nav
        aria-label={t('notFound.popularTitle', { defaultValue: '자주 찾는 페이지' })}
        className="mt-12"
        {...pageContentMotionProps}
      >
        <p className="typo-card-meta text-gray-500 dark:text-gray-400 mb-4">
          {t('notFound.popularTitle', { defaultValue: '자주 찾는 페이지' })}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {[
            { href: `/${locale}/pricing`, label: t('nav.pricing') },
            { href: `/${locale}/practice-room`, label: t('nav.practiceRoom') },
            { href: `/${locale}/portfolio`, label: t('nav.portfolio') },
            { href: `/${locale}/stories`, label: t('nav.stories') },
            { href: `/${locale}/guides/home-recording-survival`, label: t('notFound.popularGuide', { defaultValue: '홈레코딩 생존 가이드' }) },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary dark:hover:text-accent transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </m.nav>
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
