import React from 'react';
import type { NextPageWithLayout } from '../types';
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
import { homeServices, studioImages, heroContent } from '../data/home';
import { homeFaqs } from '../data/faq';

const Home: NextPageWithLayout = () => {
  return (
    <div className="overflow-visible">
      <SEO
        title="전문 음원 제작 · 믹싱&마스터링 & 성우/축가 녹음 | 스튜디오 놀"
        description="아티스트의 음악적 비전을 소리로 실현하는 프로페셔널 뮤직 프로덕션. 하이엔드 장비와 전문 엔지니어링으로 최고의 결과물을 보장합니다. 음원/앨범 제작, 믹싱, 마스터링 전문 스튜디오."
        keywords="음원 제작, 디지털 싱글, 믹싱 마스터링, 앨범 발매, 음악 프로듀싱, 전문 녹음실, 성우 녹음, 축가 녹음, 스튜디오 놀"
        canonical="https://studionol.co.kr/"
        includeSchema
        faqItems={homeFaqs}
        reviewItems={reviews}
      />


      <ImageHero
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{heroContent.titlePrefix}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {heroContent.titleHighlight}
            </span>
            <span className="text-gray-100 drop-shadow-lg">{heroContent.titleSuffix}</span>
          </>
        }
        subtitle={heroContent.subtitle}
        backgroundImage={heroContent.backgroundImage}
        imageAlt={heroContent.imageAlt}
        minHeight="min-h-[100vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        ctaButtons={
          <>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-white text-primary-dark font-bold text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              {heroContent.cta.reserve}
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center justify-center bg-primary border-2 border-primary text-white font-bold text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              {heroContent.cta.portfolio}
            </Link>
          </>
        }
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

Home.hasHero = true;

export const getStaticProps = () => ({
  props: {},
});
