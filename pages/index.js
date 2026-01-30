import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import FeatureCard from '../components/ui/FeatureCard';
import ImageHero from '../components/common/ImageHero';
import MediaGallery from '../components/ui/MediaGallery';
import ResponsiveImage from '../components/ResponsiveImage';
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
        faqItems={[
          {
            question: '스튜디오 놀의 위치는 어디인가요?',
            answer: '서울특별시 은평구 대조동 84-3 3층에 위치해 있습니다. 지하철 6호선 불광역 7번 출구 또는 연신내역에서 도보 5분 거리입니다.',
          },
          {
            question: '녹음실 이용 요금은 얼마인가요?',
            answer: '시간당 레코딩은 100,000원이며 최소 2시간 예약이 필요합니다. 6시간 패키지(Day Lock)는 500,000원으로 약 17% 할인이 적용됩니다. 전문 엔지니어링이 포함됩니다.',
          },
          {
            question: '믹싱 서비스 가격은 어떻게 되나요?',
            answer: '트랙 수에 따라 다릅니다. 10트랙 이하는 200,000원, 11~30트랙은 350,000원, 31트랙 이상은 500,000원입니다. 기본 2회 수정이 포함됩니다.',
          },
          {
            question: '마스터링 비용은 얼마인가요?',
            answer: '싱글 마스터링은 곡당 100,000원이며, EP/앨범 패키지(4곡 이상)는 곡당 80,000원입니다. Spotify, Apple Music 등 스트리밍 플랫폼 규격에 맞게 작업됩니다.',
          },
          {
            question: '연습실 입주 프로그램이 있나요?',
            answer: '네, 월 40만 원으로 프리미엄 방음 연습실과 8가지 부가 혜택(녹음실 할인, 무료 음원 유통, 보도자료 작성 지원, 버스킹 장비 대여 등)을 제공하는 입주 프로그램이 있습니다.',
          },
          {
            question: '어떤 장비를 보유하고 있나요?',
            answer: 'Neumann U87AI, AKG C414 XLS 마이크, Vintech X73i 프리앰프, Prism Sound Lyra 2 인터페이스, SSL Fusion 프로세서 등 프리미엄 아날로그/디지털 장비를 구비하고 있습니다.',
          },
          {
            question: '음원 유통 서비스도 제공하나요?',
            answer: '네, 입주 고객에게는 오디오가이 및 The Orchard를 통한 글로벌 플랫폼(Spotify, Apple Music, YouTube Music 등) 배포 서비스를 무료로 제공하며, 순이익의 70%를 아티스트에게 배분합니다.',
          },
        ]}
      />

      <ImageHero
        title={
          <>
            <span className="whitespace-nowrap">당신의 음악에</span>{' '}
            <span className="text-accent-light">생명</span>을 불어넣는 공간
          </>
        }
        subtitle="최고급 장비와 전문 엔지니어가 함께하는 스튜디오 놀에서 당신만의 사운드를 완성하세요."
        backgroundImage="/images/studio2.jpg"
        imageAlt="스튜디오 놀 메인 스튜디오"
        minHeight="min-h-[90vh]"
        overlayGradient="bg-gradient-to-b from-black/70 via-black/50 to-black/70"
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
                    <ArrowRight size={14} />
                  </motion.span>
                </div>
              }
            />
          ))}
        </motion.div>

        <motion.div
          className="mt-16 overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
            <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
              <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white leading-tight">
                상상했던 사운드,<br />
                <span className="text-primary">현실이 되는 곳</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed">
                최고의 장비와 편안한 공간에서 당신만의 음악을 완성하세요.<br className="hidden md:block" />
                스튜디오 놀이 당신의 음악적 여정을 함께합니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600"
                >
                  오시는 길
                </Link>
                <a
                  href="https://open.kakao.com/me/nol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                >
                  <CalendarCheck className="mr-2" size={20} />
                  예약 문의하기
                </a>
              </div>
            </div>

            <a
              href="https://open.kakao.com/me/nol"
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
            >
              <ResponsiveImage
                src="/images/hardware5.jpg"
                alt="스튜디오 놀 메인 작업실 전경"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 768px) 50vw, 100vw"
                fill
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;

Home.hasHero = true;

export const getStaticProps = () => ({
  props: {},
});
