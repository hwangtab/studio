import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Phone, Mail, MessageCircle, MapPin } from 'lucide-react';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
import FeatureCard from '../components/ui/FeatureCard';
import BaseCard from '../components/ui/BaseCard';
import { coreServices, productionProcess, advantages } from '../data/services';
import { SECTION_BG } from '../utils/sectionStyles';

const About = () => {

  return (
    <div className="overflow-visible">
      <SEO
        title="스튜디오 놀 소개 - 올인원 음악 프로덕션"
        description="한 곡의 아이디어가 완성된 앨범이 되기까지, 스튜디오 놀은 그 모든 과정의 동반자입니다. 녹음을 넘어 기획, 디자인, 유통, 홍보까지."
        keywords="스튜디오 놀 소개, 음반 제작 프로세스, 음악 프로덕션, 레코딩 스튜디오, 믹싱 마스터링, 음원 유통, 음악 기획, 아날로그 장비"
        canonical="https://studionol.co.kr/about"
      />
      {/* 헤더 섹션 */}
      <section className={`${SECTION_BG.hero} pt-16 pb-12`}>
        <div className="container mx-auto px-4">
          <motion.h1
            className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
            {...PAGE_TITLE_ANIMATION}
          >
            스튜디오 놀
          </motion.h1>

          <motion.div
            className="max-w-3xl mx-auto text-center mb-10"
            {...PAGE_SUBTITLE_ANIMATION}
          >
            <h2 className="typo-card-title text-gray-600 dark:text-gray-200 mb-6">
              기획부터 유통, 홍보까지 함께하는{" "}
              <span className="whitespace-nowrap">올인원 프로덕션</span>
            </h2>
            <p className="typo-section-lead mb-6">
              한 곡의 아이디어가 완성된 앨범이 되기까지,{" "}
              <span className="whitespace-nowrap">스튜디오 놀은 그 모든 과정의 동반자입니다.</span>
              <br />
              녹음을 넘어 기획, 디자인, 유통, 홍보까지{" "}
              <span className="whitespace-nowrap">뮤지션의 비전을 현실로 만드는 올인원 프로덕션 파트너입니다.</span>
            </p>
          </motion.div>

          {/* 메인 이미지 */}
          <motion.div
            className="relative rounded-xl overflow-hidden shadow-2xl max-w-4xl mx-auto h-[400px] mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ResponsiveImage
              src={`/images/studio2.jpg`}
              alt="스튜디오 놀 메인"
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              priority={true}
              width={1000}
              height={400}
              sizes="(min-width: 1024px) 60vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-8">
              <h3 className="text-heading-3 font-title font-bold text-white mb-2">
                <span className="whitespace-nowrap">올인원 음악</span> 프로덕션 서비스
              </h3>
              <p className="text-body-1-extra-light text-white/90 max-w-2xl">앨범 기획부터 유통, 홍보까지 모든 과정을 한 곳에서 제공하는 토털 솔루션</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 올인원 프로덕션 서비스 */}
      <section className={`pt-16 pb-12 ${SECTION_BG.alternate}`}>
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">
              <span className="whitespace-nowrap">올인원 음악</span> 프로덕션 서비스
            </h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              앨범 기획부터 유통, 홍보까지 모든 과정을 한 곳에서 제공하여{" "}
              <span className="whitespace-nowrap">뮤지션의 비전을 실현하는 토털 솔루션을 제공합니다.</span>
              <br />
              개별 과정마다 전문가 연계로 최상의 결과물을 보장합니다.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {coreServices.map((service, index) => (
              <FeatureCard
                key={service.title}
                title={service.title}
                description={service.description}
                icon={service.icon}
                delay={0.1 * (index + 1)}
                size="lg"
              />
            ))}
          </div>
        </div>
      </section>

      {/* 종합 음반 제작 프로세스 */}
      <section className="pt-16 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">종합 음반 제작 프로세스</h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              스튜디오 놀은 음반 제작의 모든 단계를 체계적으로 관리하여{" "}
              <span className="whitespace-nowrap">최고 품질의 결과물을 만들어냅니다.</span>
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productionProcess.map((step, index) => (
              <FeatureCard
                key={step.title}
                title={step.title}
                description={step.description}
                icon={step.icon}
                delay={0.1 * (index + 1)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 스튜디오 놀의 차별점 */}
      <section className={`pt-16 pb-12 ${SECTION_BG.highlight}`}>
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">스튜디오 놀의 차별점</h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              연신내에 위치한 원스톱 프로덕션 시스템으로{" "}
              <span className="whitespace-nowrap">아날로그 장비를 통한 따뜻하고 감칠맛 있는 사운드를 구현합니다.</span>
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <BaseCard
              variant="default"
              className="p-6"
            >
              <h3 className="typo-card-title text-gray-600 dark:text-gray-200 mb-4">비용 효율적인 패키지 옵션</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">개별 서비스 이용보다 통합 패키지로 비용 절감</p>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">뮤지션 상황에 맞춘 맞춤형 서비스 구성</p>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">독립 뮤지션을 위한 맞춤형 인프라 제공</p>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                  <p className="typo-card-body">아날로그 장비를 통한 따뜻하고 감칠맛 있는 사운드 구현</p>
                </li>
              </ul>
            </BaseCard>

            <motion.div
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {advantages.map((advantage, index) => (
                <BaseCard
                  key={index}
                  variant="default"
                  delay={0.2 + 0.1 * index}
                  className="p-4"
                >
                  <div className="flex items-center mb-2">
                    <advantage.icon className="text-primary dark:text-primary-light mr-2" />
                    <h4 className="typo-card-subtitle text-gray-600 dark:text-gray-200">{advantage.title}</h4>
                  </div>
                  <p className="typo-card-body">{advantage.description}</p>
                </BaseCard>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 연락 및 상담 */}
      <section className={`pt-16 pb-12 ${SECTION_BG.alternate}`}>
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="typo-section-title mb-4 text-gray-600 dark:text-gray-200">연락 및 상담</h2>
            <p className="typo-section-lead max-w-3xl mx-auto">
              무료 프로덕션 상담을 제공해 드립니다. 언제든지 아래 연락처로 문의해 주세요.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <BaseCard
              delay={0.1}
              className="p-6 text-center cursor-pointer"
              onClick={() => window.open('tel:02-764-3114', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <Phone className="text-primary dark:text-primary-light" size={20} />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">전화</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">02-764-3114</p>
            </BaseCard>

            <BaseCard
              delay={0.2}
              className="p-6 text-center cursor-pointer"
              onClick={() => window.open('mailto:contact@kosmart.org', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <Mail className="text-primary dark:text-primary-light" size={20} />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">이메일</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">contact@kosmart.org</p>
            </BaseCard>

            <BaseCard
              delay={0.3}
              className="p-6 text-center cursor-pointer"
              onClick={() => window.open('https://open.kakao.com/me/nol', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <MessageCircle className="text-primary dark:text-primary-light" size={20} />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">카카오톡</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">오픈채팅 바로가기</p>
            </BaseCard>

            <BaseCard
              delay={0.4}
              className="p-6 text-center cursor-pointer"
              onClick={() => window.open('https://naver.me/5gFZhS3X', '_blank')}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <MapPin className="text-primary dark:text-primary-light" size={20} />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-600 dark:text-gray-200">위치</h3>
              <p className="typo-card-body hover:text-primary dark:hover:text-primary-light transition-colors">서울특별시 은평구 대조동 84-3 3층</p>
            </BaseCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-dark via-secondary to-accent text-white text-center px-6 py-16 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
            <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-white/30 via-transparent to-black/30 pointer-events-none"></div>
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">스튜디오 놀과 함께하세요!</h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                지금 바로 상담 예약이 가능합니다.<br />
                프로젝트의 규모와 상관없이 언제든 편하게 문의주세요.<br />
                첫 상담부터 최종 마스터링까지 함께합니다.
              </p>
              <Link href="/contact" passHref legacyBehavior>
                <motion.a
                  className="inline-block bg-white text-primary-dark font-bold py-4 px-10 rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  연락하기
                </motion.a>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;

export const getStaticProps = () => ({
  props: {},
});
