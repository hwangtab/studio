import type { GetStaticProps, NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import Section from '../components/ui/Section';
import SectionHeading from '../components/ui/SectionHeading';
import { defaultLocale, locales, type Locale } from '../lib/i18n';
import { getLocaleI18nResourcesServer } from '../lib/i18n.server';

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

  return (
    <Section
      tone="deep"
      orbs={[{ color: 'mint', size: 600, top: '-100px', right: '-80px', opacity: 0.5 }]}
      className="min-h-screen flex flex-col justify-center text-center"
    >
      <SEO
        title={t('notFound.seoTitle')}
        description="404 Not Found"
        robots="noindex, nofollow, noarchive, nosnippet"
        disableCanonicalAndAlternates
      />

      <p className="font-display font-light text-display-mega text-on-dark leading-none mb-6" aria-hidden="true">
        404
      </p>

      <SectionHeading
        title={t('notFound.title')}
        lead={t('notFound.messageLine1')}
        align="center"
        as="h1"
        className="mb-10"
      />

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
        <a
          href={`/${locale}`}
          className="inline-flex h-14 px-7 items-center rounded-pill bg-white text-ink font-medium hover:bg-on-dark-soft transition-all"
        >
          {t('notFound.goHome')}
        </a>
        <Link
          href={`/${locale}/contact`}
          className="inline-flex h-14 px-7 items-center rounded-pill border border-white/20 text-on-dark hover:bg-white/[0.06] transition-all"
        >
          {t('notFound.contact')}
        </Link>
      </div>
    </Section>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {
      i18nResources: getLocaleI18nResourcesServer(defaultLocale),
    },
  };
};

export default NotFoundPage;
