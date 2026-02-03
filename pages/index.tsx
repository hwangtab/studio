import React from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarCheck, ArrowRight, Mic2, Music, Sparkles } from 'lucide-react';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import FeatureCard from '../components/ui/FeatureCard';
import FAQSection from '../components/ui/FAQSection';
import SectionHeading from '../components/ui/SectionHeading';
import ImageHero from '../components/common/ImageHero';
import MediaGallery from '../components/ui/MediaGallery';
import ReviewSection, { reviews } from '../components/ui/ReviewSection';
import ResponsiveImage from '../components/ResponsiveImage';
import { homeServices, studioImages } from '../data/home';

const homeFaqs = [
  {
    question: '스튜디오 놀의 위치는 어디인가요?',
    answer: '서울특별시 은평구 대조동 84-3 3층(동명여고 바로 옆)에 위치해 있습니다. 지하철 6호선 불광역 7번 출구 또는 연신내역에서 도보 5분 거리입니다.',
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
    answer: '네, 입주 고객에게는 오디오가이를 통한 글로벌 플랫폼(Spotify, Apple Music, YouTube Music 등) 배포 서비스를 무료로 제공하며, 순이익의 70%를 아티스트에게 배분합니다.',
  },
];

const Home: NextPage = () => {
  return (
    <div className="overflow-visible">
      <SEO
        title="전문 음반 제작 · 믹싱&마스터링 & 성우/축가 녹음 | 스튜디오 놀"
        description="아티스트의 음악적 비전을 소리로 실현하는 프로페셔널 뮤직 프로덕션. 하이엔드 장비와 전문 엔지니어링으로 최고의 결과물을 보장합니다. 앨범 제작, 믹싱, 마스터링 전문 스튜디오."
        keywords="음반 제작, 믹싱 마스터링, 앨범 발매, 음악 프로듀싱, 전문 녹음실, 성우 녹음, 축가 녹음, 스튜디오 놀"
        canonical="https://studionol.co.kr/"
        includeSchema
        // @ts-ignore - SEO component is JS
        faqItems={homeFaqs}
        reviewItems={reviews}
      />


      <ImageHero
        {...{
          title: (
            <>
              <span className="block mb-2 text-gray-100 drop-shadow-lg">당신의 음악에</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white font-black drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
                생명
              </span>
              <span className="text-gray-100 drop-shadow-lg">을 불어넣는 공간</span>
            </>
          ),
          subtitle: "최고급 장비와 전문 엔지니어의 터치로 완성되는 당신만의 사운드. 스튜디오 놀에서 경험하세요.",
          backgroundImage: "/images/studio2.jpg",
          imageAlt: "스튜디오 놀 메인 스튜디오",
          minHeight: "min-h-[100vh]",
          overlayGradient: "from-black/40 via-transparent to-black/20",
          ctaButtons: (
            <>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center bg-white text-primary-dark font-bold text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                예약하기
              </Link>
              <Link
                href="/portfolio"
                className="inline-flex items-center justify-center bg-primary border-2 border-primary text-white font-bold text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                포트폴리오
              </Link>
            </>
          ),
        } as any}
      />

      {/* 스튜디오 갤러리 섹션 */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <SectionHeading
            icon={Mic2}
            title="당신을 위한 녹음 공간과 장비"
            className="mb-12"
          />
          <MediaGallery images={studioImages} />
        </div>
      </section>

      {/* 서비스 소개 섹션 */}
      <section className="py-24 bg-gray-50/50 dark:bg-gray-800/10">
        <div className="container mx-auto px-4">
          <SectionHeading
            icon={Music}
            title="우리의 서비스"
            className="mb-12"
          />
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
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
                  <div className="inline-flex items-center typo-card-cta hover:text-primary-dark dark:hover:text-primary-light/80 transition-colors duration-300">
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
        </div>
      </section>


      {/* 리뷰 섹션 */}
      <ReviewSection className="py-24 bg-white dark:bg-gray-900" />

      {/* FAQ 섹션 */}
      <FAQSection
        items={homeFaqs}
        className="py-24 bg-gray-50/50 dark:bg-gray-800/10"
      />

      {/* 하단 CTA 섹션 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            className="overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
              <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
                <SectionHeading
                  icon={Sparkles}
                  title={
                    <>
                      상상했던 사운드,<br />
                      <span className="text-primary">현실이 되는 곳</span>
                    </>
                  }
                  subtitle={
                    <>
                      최고의 장비와 편안한 공간에서 당신만의 음악을 완성하세요.<br className="hidden md:block" />
                      스튜디오 놀이 당신의 음악적 여정을 함께합니다.
                    </>
                  }
                  align="left"
                  className="mb-8"
                />
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
                  width={800}
                  height={600}
                  fill
                />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;

(Home as any).hasHero = true;

export const getStaticProps = () => ({
  props: {},
});
