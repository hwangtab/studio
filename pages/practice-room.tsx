import type { NextPage } from 'next'; import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, MessageCircle, HelpCircle, Target, ShieldCheck } from 'lucide-react';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
import ImageHero from '../components/common/ImageHero';
import BaseCard from '../components/ui/BaseCard';
import FAQSection from '../components/ui/FAQSection';
import SectionHeading from '../components/ui/SectionHeading';

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: any, title: string, description: string, delay?: number }) => (
  <BaseCard variant="default" delay={delay} className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} />
      </div>
      <h3 className="typo-card-title">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

const PainPoint = ({ icon: Icon, text, delay = 0 }: { icon: any, text: string, delay?: number }) => (
  <BaseCard variant="default" delay={delay} className="p-5 h-full">
    <div className="flex items-start">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-full mr-4 text-white flex-shrink-0">
        <Icon size={20} />
      </div>
      <div>
        <p className="typo-card-body whitespace-normal" style={{ wordBreak: 'keep-all' }}>{text}</p>
      </div>
    </div>
  </BaseCard>
);

const TargetAudience = ({ title, description, icon: Icon, delay = 0 }: { title: string, description: string, icon: any, delay?: number }) => (
  <BaseCard variant="default" delay={delay} className="p-6 mb-4">
    <div className="flex items-center mb-2">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} />
      </div>
      <h3 className="typo-card-subtitle">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

const practiceRoomFaqs = [
  {
    question: '은평구 어디에서 가깝나요?',
    answer: '동명여고 바로 옆에 위치하고 있습니다. 연신내역에서 도보 5분 거리로 연신내, 불광, 구산, 역촌, 응암 등 은평구 주요 지역에서 접근성이 매우 뛰어납니다.',
  },
  {
    question: '연습실은 24시간 이용 가능한가요?',
    answer: '네, 연습실 입주 고객은 24시간 언제든 각 방별 도어록 번호키를 통해 자유롭게 출입하고 작업하실 수 있습니다.',
  },
  {
    question: '주차장이나 대중교통 이용은 어떻게 되나요?',
    answer: '주차는 도보 1-2분 거리의 저렴한 대조동 공영주차장을 이용하실 수 있습니다. 대중교통은 불광역(3, 6호선) 또는 연신내역(3, 6호선) 이용이 편리하며, 버스는 "동명여고.천주교불광동성당" 정류장에서 하차하시면 바로 앞입니다.',
  },
  {
    question: '여름이나 겨울에 냉난방 이용이 자유로운가요?',
    answer: '모든 연습실마다 개별 제어가 가능한 최신형 무풍 냉난방기 시스템이 완비되어 있어 사계절 내내 쾌적하게 작업할 수 있습니다.',
  },
  {
    question: '악기나 장비를 두고 다녀도 안전한가요?',
    answer: '열 개의 CCTV가 사각지대 없이 복도와 공동 구역을 24시간 녹화하며, 각 방마다 개별 디지털 도어록이 설치되어 있어 보안이 철저합니다.',
  },
  {
    question: '방음 성능은 어느 정도인가요?',
    answer: '방송국 수준의 STC 차음 설계를 적용하여 옆방과의 소리 간섭을 최소화했습니다. 보컬, 성우 녹음은 물론 미디 작업 시에도 높은 몰입감을 제공합니다.',
  },
];

const PracticeRoom: NextPage = () => {
  return (
    <>
      <SEO
        title="연신내 · 불광 · 구산 · 역촌 · 응암 방음 연습실 | 프리미엄 24시 작업실 | 스튜디오 놀"
        description="연신내, 불광, 구산, 역촌, 응암 등 은평구 주요 지역에서 접근성이 뛰어난 프리미엄 방음 연습실. 24시간 완벽 공조 시스템과 방송국급 차음 설계를 제공하는 최상의 작업 공간입니다."
        keywords="연신내 연습실, 불광 연습실, 구산 연습실, 역촌 연습실, 응암 연습실, 은평구 연습실, 대조동 연습실, 방음 연습실, 개인 작업실, 스튜디오 놀"
        canonical="https://studionol.co.kr/practice-room"
        includeSchema={true}
        // @ts-ignore - SEO component is JS
        faqItems={practiceRoomFaqs}
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '연습실', path: '/practice-room' },
        ]}
      />
      <ImageHero
        title="은평구 프리미엄 방음 연습실"
        subtitle={
          <>
            최적의 환경에서 여러분의 음악을 연습하세요.
            <br />
            다양한 장비와 시설을 갖춘 프리미엄 연습실에서 음악을 즐기세요.
          </>
        }
        backgroundImage="/images/room5.jpg"
        imageAlt="스튜디오 놀 연습실"
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/60 via-black/40 to-transparent"
      />
      <div className="container mx-auto px-4 py-16">
        {/* 고민 섹션 */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <SectionHeading
            icon={HelpCircle}
            title="이런 고민이 있으신가요?"
            className="mb-8"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <PainPoint icon={Wind} text="에어컨에서 떨어지는 물방울 때문에 장비가 망가질까 불안해요..." delay={0.1} />
            <PainPoint icon={VolumeX} text="옆방 소리가 다 들려서 집중이 안 돼요..." delay={0.2} />
            <PainPoint icon={Wind} text="공기가 잘 통하지 않아 답답해요..." delay={0.3} />
            <PainPoint icon={Zap} text="전기 노이즈 때문에 녹음을 다시 해야 해요..." delay={0.4} />
            <PainPoint icon={Sparkles} text="작업환경이 불쾌하고 지저분해요..." delay={0.5} />
          </div>
        </motion.div>

        {/* 타겟 오디언스 섹션 */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <SectionHeading
            icon={Target}
            title="이런 분들을 위한 공간"
            className="mb-6"
            titleClassName="text-primary"
          />

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <TargetAudience
              title="로컬 뮤지션"
              description="연신내, 불광, 구산, 역촌, 응암 인근에서 나만의 아지트 같은 작업실을 찾는 분"
              icon={MapPin}
              delay={0.1}
            />
            <TargetAudience
              title="콘텐츠 크리에이터"
              description="유튜버, 팟캐스터, 스트리머를 위한 녹음 스튜디오"
              icon={Star}
              delay={0.2}
            />
            <TargetAudience
              title="음악 교육"
              description="프라이빗 레슨, 소규모 마스터클래스, 학원 분원용 연습실"
              icon={Music}
              delay={0.3}
            />
          </div>

          {/* 이미지 갤러리 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/room2.jpg`}
                alt="드럼과 앰프가 갖춰진 밴드 합주실 전경"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/room3.jpg`}
                alt="흡음 패널이 설치된 방음 연습실 내부"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/room4.jpg`}
                alt="기타 앰프와 이펙터가 준비된 개인 연습실"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-48"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/room5.jpg`}
                alt="쾌적한 환경의 보컬 녹음 부스 내부"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                fill
              />
            </motion.div>
          </div>
        </motion.div>

        {/* 특징 섹션 */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <SectionHeading
            icon={ShieldCheck}
            title="뮤지션을 위한 완벽한 시스템"
            titleClassName="text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
            className="mb-12"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <FeatureCard
              icon={Music}
              title="진정한 프로의 작업 환경"
              description="국제표준 STC 방음 시스템, 이중 벽체 설계로 완벽한 소리 차단, 전문 방진 시공으로 진동 차단, DAW 작업에 최적화된 조명 설계"
              delay={0.1}
            />

            <FeatureCard
              icon={Shield}
              title="장비 보호 시스템"
              description="특수 설계 시스템 냉난방기, 결로 현상 완벽 차단, 장비 손상 위험 ZERO, 최적 습도 자동 유지"
              delay={0.2}
            />

            <FeatureCard
              icon={Star}
              title="프로덕션 최적화 시설"
              description="기가비트 급 초고속 인터넷, 전문가급 음향 설비 완비, 업라이트 피아노 설치 가능, 노이즈리스 전기 시설"
              delay={0.3}
            />

            <FeatureCard
              icon={MapPin}
              title="위치 및 접근성"
              description="불광역/연신내역 도보 5분, 24시간 보안 시스템, 조용한 작업 환경"
              delay={0.4}
            />
          </div>

          {/* 추가 이미지 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-64"
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/room6.jpg`}
                alt="넓은 공간에 어쿠스틱 패널이 설치된 방음 연습실"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                fill
              />
            </motion.div>
            <motion.div
              className="rounded-lg overflow-hidden shadow-md h-64 md:col-span-2"
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveImage
                src={`/images/room7.jpg`}
                alt="전문 장비가 갖춰진 컨트롤룸 전경"
                className="w-full h-full object-cover"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                fill
              />
            </motion.div>
          </div>
        </motion.div>

        {/* CTA 섹션 */}
      </div>
      <FAQSection
        items={practiceRoomFaqs}
        title="연습실 FAQ"
        subtitle="작업실 입주와 이용에 관해 가장 많이 하시는 질문들입니다."
      />

      <div className="container mx-auto px-4 pb-16">
        {/* CTA 섹션 */}
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
                    최적의 몰입,<br />
                    <span className="text-primary">최고의 결과물</span>
                  </>
                }
                subtitle={
                  <>
                    24시간 쾌적한 환경에서 오직 음악에만 집중하세요.<br className="hidden md:block" />
                    지금 바로 방문하여 스튜디오를 직접 둘러보실 수 있습니다.
                  </>
                }
                align="left"
                className="mb-8"
              />

              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
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
                  <MessageCircle className="mr-2" size={20} />
                  카카오톡 문의하기
                </a>
              </motion.div>
            </div>

            <a
              href="https://open.kakao.com/me/nol"
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
            >
              <ResponsiveImage
                src={`/images/room8.jpg`}
                alt="자연광이 들어오는 쾌적한 연습실 공간"
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
    </>
  );
};

export default PracticeRoom;

(PracticeRoom as any).hasHero = true;

export const getStaticProps = () => ({
  props: {},
});
