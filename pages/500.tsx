import type { GetStaticProps, NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import { Section } from '../components/ui/Section';
import { Button } from '../components/ui/Button';
import { defaultLocale, locales, type Locale } from '../lib/i18n';
import { getAllLocalesI18nResourcesServer } from '../lib/i18n.server';

const ServerErrorPage: NextPage = () => {
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
  // variant가 표현하지 못하는 레이아웃(모바일 전폭·가변 높이·긴 라벨 줄바꿈)만 유지한다.
  const errorCtaLayout = 'w-full sm:w-auto h-auto min-h-[44px] px-6 py-3 text-center whitespace-normal leading-snug touch-manipulation';

  return (
    <Section variant="default" className="min-h-[60vh] flex flex-col justify-center text-center">
      <SEO
        title={t('serverError.seoTitle')}
        description="500 Internal Server Error"
        robots="noindex, nofollow"
        disableUrlMetaAndAlternates
      />

      {/* badge를 h1(delay 0)보다 DOM에 먼저 두므로 진입 delay를 0으로 맞춰 (latent) 순서 역전 제거 */}
      <m.div
        className="inline-flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-6 py-3 mb-6 typo-card-subtitle text-primary-dark dark:text-primary-light"
        {...PAGE_SUBTITLE_ANIMATION}
        transition={{ ...PAGE_SUBTITLE_ANIMATION.transition, delay: 0 }}
      >
        {t('serverError.badge')}
      </m.div>

      <m.h1
        className="text-heading-1 font-title mb-6"
        {...PAGE_TITLE_ANIMATION}
      >
        {t('serverError.title')}
      </m.h1>

      <m.p
        className="typo-section-lead max-w-2xl mx-auto mb-10 text-gray-600 dark:text-gray-300"
        {...pageContentMotionProps}
      >
        <>
          <span className="block">{t('serverError.messageLine1')}</span>
          <span className="block">{t('serverError.messageLine2')}</span>
        </>
      </m.p>

      <m.div
        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
        {...pageContentMotionProps}
      >
        <Button asChild variant="solid" shape="pill" size="md">
          <Link href={`/${locale}`} className={errorCtaLayout}>
            {t('serverError.goHome')}
          </Link>
        </Button>
        <Button asChild variant="outline" shape="pill" size="md">
          <Link href={`/${locale}/contact`} className={errorCtaLayout}>
            {t('serverError.contact')}
          </Link>
        </Button>
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

export default ServerErrorPage;
