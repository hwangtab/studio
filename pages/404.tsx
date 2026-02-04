import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import { Section } from '../components/ui/Section';

const NotFoundPage: NextPage = () => {
  const router = useRouter();
  const path = router.asPath;

  return (
    <Section variant="default" className="min-h-[60vh] flex flex-col justify-center text-center">
      <SEO
        title="페이지를 찾을 수 없습니다 | 스튜디오 놀"
        description="요청하신 페이지를 찾을 수 없습니다. 스튜디오 놀 홈페이지로 이동하거나 다른 페이지를 탐색해 주세요."
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
        찾으시는 페이지가 없습니다
      </motion.h1>

      <motion.p
        className="typo-section-lead max-w-2xl mx-auto mb-10"
        {...PAGE_CONTENT_ANIMATION}
      >
        {path ? `요청하신 주소 "${path}"가 존재하지 않거나 이동되었어요.` : '요청하신 페이지가 존재하지 않거나 이동되었어요.'}
        <br className="hidden sm:block" />
        아래 버튼을 통해 홈으로 이동하거나, 다른 페이지를 탐색해 주세요.
      </motion.p>

      <motion.div
        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
        {...PAGE_CONTENT_ANIMATION}
        transition={{ ...PAGE_CONTENT_ANIMATION.transition, delay: 0.6 }}
      >
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors duration-300 typo-button"
        >
          홈으로 이동
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-primary text-primary hover:bg-primary/10 dark:border-primary-light dark:text-primary-light transition-colors duration-300 typo-button"
        >
          문의하기
        </Link>
      </motion.div>
    </Section>
  );
};

export default NotFoundPage;
