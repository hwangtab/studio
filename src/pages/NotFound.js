import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="container mx-auto px-4 py-20 sm:py-28 text-center">
      <Helmet>
        <title>페이지를 찾을 수 없습니다 | 스튜디오 놀</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <motion.div
        className="inline-flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 px-6 py-3 mb-6 typo-card-subtitle text-primary-dark dark:text-primary-light"
        {...PAGE_SUBTITLE_ANIMATION}
      >
        404 Not Found
      </motion.div>

      <motion.h1
        className="text-heading-1 font-title text-gray-800 dark:text-gray-100 mb-6"
        {...PAGE_TITLE_ANIMATION}
      >
        찾으시는 페이지가 없습니다
      </motion.h1>

      <motion.p
        className="typo-section-lead text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10"
        {...PAGE_CONTENT_ANIMATION}
      >
        {location?.pathname
          ? `요청하신 주소 "${location.pathname}"가 존재하지 않거나 이동되었어요.`
          : '요청하신 페이지가 존재하지 않거나 이동되었어요.'}
        <br className="hidden sm:block" />
        아래 버튼을 통해 홈으로 이동하거나, 다른 페이지를 탐색해 주세요.
      </motion.p>

      <motion.div
        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
        {...PAGE_CONTENT_ANIMATION}
        transition={{ ...PAGE_CONTENT_ANIMATION.transition, delay: 0.6 }}
      >
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors duration-300 typo-button"
        >
          홈으로 이동
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-primary text-primary hover:bg-primary/10 dark:border-primary-light dark:text-primary-light transition-colors duration-300 typo-button"
        >
          문의하기
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
