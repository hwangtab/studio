import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaCalendarCheck, FaArrowRight } from 'react-icons/fa';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import FeatureCard from '../components/ui/FeatureCard';
import HeroBanner from '../components/common/HeroBanner';
import MediaGallery from '../components/ui/MediaGallery';
import { homeServices, studioImages } from '../data/home';

const Home = () => {
  return (
    <div className="overflow-visible">
      <SEO
        title="연신내 녹음실 · 은평구 연습실 | 스튜디오 놀 음악 제작 스튜디오"
        description="연신내역 도보 5분, 스튜디오 놀에서 녹음실·연습실·믹싱/마스터링 서비스를 한 번에 이용하세요. 프로 장비와 엔지니어가 상주해 보컬 녹음, 밴드 합주, 콘텐츠 제작까지 지원합니다."
        keywords="연신내 녹음실, 은평구 연습실, 스튜디오 놀, 서울 녹음실, 믹싱 마스터링 스튜디오, 음악 제작 스튜디오"
        canonical="https://studionol.co.kr/"
        includeSchema={true}
      />

      <HeroBanner
        title={
          <>
            <span className="whitespace-nowrap">당신의 음악에</span>{' '}
            <span className="text-accent-light">생명</span>을 불어넣는 공간
          </>
        }
        subtitle="최고급 장비와 전문 엔지니어가 함께하는 스튜디오 놀에서 당신만의 사운드를 완성하세요."
        ctaButtons={
          <>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-white text-primary-dark text-body-1 leading-none py-3 px-8 rounded-full hover:bg-white/90 transition duration-300 shadow-lg"
            >
              예약하기
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center justify-center bg-transparent border-2 border-white text-white text-body-1 leading-none py-3 px-8 rounded-full hover:bg-white/10 transition duration-300"
            >
              포트폴리오 보기
            </Link>
          </>
        }
        image="/images/studio1.jpg"
        imageAlt="스튜디오 놀 메인 스튜디오"
      />

      <div className="container mx-auto px-4 pt-16 pb-12">
        <motion.h2
          className="word-break-keep-all text-heading-2 font-title font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
          {...PAGE_TITLE_ANIMATION}
        >
          당신을 위한 녹음 공간과 장비
        </motion.h2>

        <MediaGallery images={studioImages} />

        <motion.h2
          className="word-break-keep-all text-heading-2 font-title font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
          {...PAGE_SUBTITLE_ANIMATION}
        >
          우리의 서비스
        </motion.h2>
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
          {...PAGE_CONTENT_ANIMATION}
        >
          {homeServices.map((service, index) => (
            <FeatureCard
              key={service.title}
              icon={service.icon}
              title={service.title}
              description={service.description}
              href={service.link}
              variant="highlight"
              delay={0.1 * (index + 1)}
              cta={
                <div className="inline-flex items-center typo-card-cta text-gray-600 dark:text-gray-200 hover:text-primary-dark dark:hover:text-primary-light/80 transition-colors duration-300">
                  자세히 보기
                  <motion.span
                    className="ml-1"
                    initial={{ x: 0 }}
                    whileHover={{ x: 5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <FaArrowRight size={14} />
                  </motion.span>
                </div>
              }
            />
          ))}
        </motion.div>

        <motion.div
          className="text-center bg-gray-50 dark:bg-gray-800 pt-16 pb-12 px-4 rounded-2xl shadow-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
        >
          <h2 className="typo-card-title mb-4 text-gray-600 dark:text-gray-200">당신의 음악 여정을 시작하세요</h2>
          <p className="typo-section-lead mb-8 max-w-2xl mx-auto text-center">
            최고의 환경에서 음악을 완성하세요.<br />
            스튜디오 놀이 당신의 음악적 여정을 함께합니다.
          </p>
          <Link href="/contact" className="inline-flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white text-body-1 py-3 px-8 rounded-full hover:from-primary-dark hover:to-secondary-dark transition duration-300 shadow-md">
            <FaCalendarCheck className="mr-2" />
            스튜디오 예약하기
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;

export const getStaticProps = () => ({
  props: {},
});
