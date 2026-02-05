import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import { Section } from '../components/ui/Section';
import { defaultLocale, locales } from '../lib/i18n';

const NotFoundPage: NextPage = () => {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [locale, setLocale] = useState(defaultLocale);
  const { t } = useTranslation('common', { lng: locale });

  useEffect(() => {
    if (router.isReady) {
      setPath(router.asPath);
      
      // Attempt to extract locale from path: /en/wrong-page -> en
      const segments = router.asPath.split('/');
      const potentialLocale = segments[1];
      if (locales.includes(potentialLocale as any)) {
        setLocale(potentialLocale as any);
      }
    }
  }, [router.isReady, router.asPath]);

  return (
    <Section variant="default" className="min-h-[60vh] flex flex-col justify-center text-center">
      <SEO
        title={t('notFound.seoTitle')}
        description="404 Not Found"
        robots="noindex, nofollow"
      />

      <motion.div
        className="inline-flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-6 py-3 mb-6 typo-card-subtitle text-primary-dark dark:text-primary-light"
        {...PAGE_SUBTITLE_ANIMATION}
      >
        {t('notFound.badge')}
      </motion.div>

      <motion.h1
        className="text-heading-1 font-title mb-6"
        {...PAGE_TITLE_ANIMATION}
      >
        {t('notFound.title')}
      </motion.h1>

      <motion.p
        className="typo-section-lead max-w-2xl mx-auto mb-10 text-gray-600 dark:text-gray-300"
        {...PAGE_CONTENT_ANIMATION}
      >
        <>
          {t('notFound.messageLine1', { path })}
          <br className="hidden sm:block" />
          {t('notFound.messageLine2')}
        </>
      </motion.p>

      <motion.div
        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
        {...PAGE_CONTENT_ANIMATION}
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
      </motion.div>
    </Section>
  );
};

export default NotFoundPage;
