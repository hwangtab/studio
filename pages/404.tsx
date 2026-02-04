import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import { Section } from '../components/ui/Section';
import { defaultLocale, locales } from '../lib/i18n';

const NotFoundPage: NextPage = () => {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [locale, setLocale] = useState(defaultLocale);

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

  const isKo = locale === 'ko';

  return (
    <Section variant="default" className="min-h-[60vh] flex flex-col justify-center text-center">
      <SEO
        title={isKo ? "페이지를 찾을 수 없습니다 | 스튜디오 놀" : "Page Not Found | Studio NOL"}
        description="404 Not Found"
        robots="noindex, nofollow"
      />

      <motion.div
        className="inline-flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-6 py-3 mb-6 typo-card-subtitle text-primary-dark dark:text-primary-light"
        {...PAGE_SUBTITLE_ANIMATION}
      >
        404 Not Found
      </motion.div>

      <motion.h1
        className="text-heading-1 font-title mb-6"
        {...PAGE_TITLE_ANIMATION}
      >
        {isKo ? "찾으시는 페이지가 없습니다" : "Page Not Found"}
      </motion.h1>

      <motion.p
        className="typo-section-lead max-w-2xl mx-auto mb-10 text-gray-600 dark:text-gray-300"
        {...PAGE_CONTENT_ANIMATION}
      >
        {isKo 
          ? (
            <>
              요청하신 주소 &quot;<span className="font-mono text-primary">{path}</span>&quot;가 존재하지 않거나 이동되었어요.
              <br className="hidden sm:block" />
              아래 버튼을 통해 홈으로 이동하거나, 다른 페이지를 탐색해 주세요.
            </>
          ) 
          : (
            <>
              The requested URL &quot;<span className="font-mono text-primary">{path}</span>&quot; was not found on this server.
              <br className="hidden sm:block" />
              Please return to the homepage or try another page.
            </>
          )
        }
      </motion.p>

      <motion.div
        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
        {...PAGE_CONTENT_ANIMATION}
        transition={{ ...PAGE_CONTENT_ANIMATION.transition, delay: 0.6 }}
      >
        <Link
          href={`/${locale}`}
          className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors duration-300 typo-button shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform"
        >
          {isKo ? "홈으로 이동" : "Go Home"}
        </Link>
        <Link
          href={`/${locale}/contact`}
          className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-primary text-primary hover:bg-primary/10 dark:border-primary-light dark:text-primary-light transition-colors duration-300 typo-button"
        >
          {isKo ? "문의하기" : "Contact Us"}
        </Link>
      </motion.div>
    </Section>
  );
};

export default NotFoundPage;