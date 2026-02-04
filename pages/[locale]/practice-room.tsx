import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, MessageCircle, HelpCircle, Target, ShieldCheck } from 'lucide-react';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../../utils/animationUtils';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import BaseCard from '../../components/ui/BaseCard';
import FAQSection from '../../components/ui/FAQSection';
import SectionHeading from '../../components/ui/SectionHeading';
import { Section } from '../../components/ui/Section';
import { getCommonStaticPaths, getCommonStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

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

const PracticeRoom: NextPage<{ locale: Locale }> = ({ locale }) => {
  const isKo = locale === 'ko';
  const getLink = (path: string) => `/${locale}${path}`;

  return (
    <>
      <SEO
        title={isKo ? "연신내 · 불광 · 구산 · 역촌 · 응암 방음 연습실 | 프리미엄 24시 작업실" : "Premium 24h Practice Room in Eunpyeong | Studio NOL"}
        description={isKo ? "연신내, 불광, 구산, 역촌, 응암 등 은평구 주요 지역에서 접근성이 뛰어난 프리미엄 방음 연습실." : "Premium soundproof practice rooms with great accessibility in Eunpyeong-gu."}
        keywords="연신내 연습실, 불광 연습실, 구산 연습실, 역촌 연습실, 응암 연습실, 은평구 연습실, 대조동 연습실, 방음 연습실, 개인 작업실, 스튜디오 놀"
        canonical={`https://studionol.co.kr/${locale}/practice-room`}
        includeSchema={true}
        faqItems={practiceRoomFaqs}
        breadcrumbs={[
          { name: isKo ? '홈' : 'Home', path: `/${locale}` },
          { name: isKo ? '연습실' : 'Practice Room', path: `/${locale}/practice-room` },
        ]}
      />
      <ImageHero
        title={isKo ? "은평구 프리미엄 방음 연습실" : "Premium Soundproof Practice Room"}
        subtitle={
          isKo ? (
            <>
              최적의 환경에서 여러분의 음악을 연습하세요.
              <br />
              다양한 장비와 시설을 갖춘 프리미엄 연습실에서 음악을 즐기세요.
            </>
          ) : (
            <>
              Practice your music in an optimal environment.
              <br />
              Enjoy music in a premium studio with various equipment and facilities.
            </>
          )
        }
        backgroundImage="/images/room5.jpg"
        imageAlt="스튜디오 놀 연습실"
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />

      {/* 고민 섹션 */}
      <Section variant="default">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <SectionHeading
            icon={HelpCircle}
            title={isKo ? "이런 고민이 있으신가요?" : "Are you having these troubles?"}
            className="mb-8"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <PainPoint icon={Wind} text={isKo ? "에어컨에서 떨어지는 물방울 때문에 장비가 망가질까 불안해요..." : "Worried about water from AC damaging gear..."} delay={0.1} />
            <PainPoint icon={VolumeX} text={isKo ? "옆방 소리가 다 들려서 집중이 안 돼요..." : "Distracted by sound from the next room..."} delay={0.2} />
            <PainPoint icon={Wind} text={isKo ? "공기가 잘 통하지 않아 답답해요..." : "Feeling stuffy due to poor air circulation..."} delay={0.3} />
            <PainPoint icon={Zap} text={isKo ? "전기 노이즈 때문에 녹음을 다시 해야 해요..." : "Re-recording due to electrical noise..."} delay={0.4} />
            <PainPoint icon={Sparkles} text={isKo ? "작업환경이 불쾌하고 지저분해요..." : "Unpleasant and messy working environment..."} delay={0.5} />
          </div>
        </motion.div>
      </Section>

      {/* 타겟 오디언스 섹션 */}
      <Section variant="alternate">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <SectionHeading
            icon={Target}
            title={isKo ? "이런 분들을 위한 공간" : "A space for those who..."}
            className="mb-6"
            titleClassName="text-primary"
          />

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <TargetAudience
              title={isKo ? "로컬 뮤지션" : "Local Musicians"}
              description={isKo ? "연신내, 불광, 구산, 역촌, 응암 인근에서 나만의 아지트 같은 작업실을 찾는 분" : "Those looking for a private studio in Eunpyeong-gu."}
              icon={MapPin}
              delay={0.1}
            />
            <TargetAudience
              title={isKo ? "콘텐츠 크리에이터" : "Content Creators"}
              description={isKo ? "유튜버, 팟캐스터, 스트리머를 위한 녹음 스튜디오" : "Recording studio for YouTubers, podcasters, and streamers."}
              icon={Star}
              delay={0.2}
            />
            <TargetAudience
              title={isKo ? "음악 교육" : "Music Education"}
              description={isKo ? "프라이빗 레슨, 소규모 마스터클래스, 학원 분원용 연습실" : "Studios for private lessons and masterclasses."}
              icon={Music}
              delay={0.3}
            />
          </div>

          {/* 이미지 갤러리 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="rounded-lg overflow-hidden shadow-md h-48"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <ResponsiveImage
                  src={`/images/room${i}.jpg`}
                  alt={`Practice room image ${i}`}
                  className="w-full h-full object-cover"
                  pictureClassName="block h-full"
                  loading="lazy"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  fill
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      <Section variant="default">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <SectionHeading
            icon={ShieldCheck}
            title={isKo ? "뮤지션을 위한 완벽한 시스템" : "Perfect System for Musicians"}
            titleClassName="text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
            className="mb-12"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <FeatureCard
              icon={Music}
              title={isKo ? "진정한 프로의 작업 환경" : "Professional Environment"}
              description={isKo ? "국제표준 STC 방음 시스템, 이중 벽체 설계로 완벽한 소리 차단" : "International standard STC soundproofing, double wall design."}
              delay={0.1}
            />

            <FeatureCard
              icon={Shield}
              title={isKo ? "장비 보호 시스템" : "Equipment Protection"}
              description={isKo ? "특수 설계 시스템 냉난방기, 결로 현상 완벽 차단" : "Specially designed AC, zero condensation, gear protection."}
              delay={0.2}
            />

            <FeatureCard
              icon={Star}
              title={isKo ? "프로덕션 최적화 시설" : "Optimized Facilities"}
              description={isKo ? "기가비트 급 초고속 인터넷, 전문가급 음향 설비 완비" : "Gigabit high-speed internet, pro-grade acoustic facilities."}
              delay={0.3}
            />

            <FeatureCard
              icon={MapPin}
              title={isKo ? "위치 및 접근성" : "Location & Accessibility"}
              description={isKo ? "불광역/연신내역 도보 5분, 24시간 보안 시스템" : "5-min walk from stations, 24h security system."}
              delay={0.4}
            />
          </div>
        </motion.div>
      </Section>

      <FAQSection
        items={practiceRoomFaqs}
        title={isKo ? "연습실 FAQ" : "Practice Room FAQ"}
        subtitle={isKo ? "작업실 입주와 이용에 관해 가장 많이 하시는 질문들입니다." : "Frequently asked questions about the studio."}
        variant="alternate"
      />

      <Section variant="default" className="pb-16 pt-0 md:pt-16">
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
                  isKo ? (
                    <>
                      최적의 몰입,<br />
                      <span className="text-primary">최고의 결과물</span>
                    </>
                  ) : (
                    <>
                      Optimal Focus,<br />
                      <span className="text-primary">Best Results</span>
                    </>
                  )
                }
                subtitle={
                  isKo ? (
                    <>
                      24시간 쾌적한 환경에서 오직 음악에만 집중하세요.<br className="hidden md:block" />
                      지금 바로 방문하여 스튜디오를 직접 둘러보실 수 있습니다.
                    </>
                  ) : (
                    <>
                      Focus only on music in a comfortable environment 24/7.<br className="hidden md:block" />
                      Visit us today to take a tour.
                    </>
                  )
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
                  href={getLink("/contact")}
                  className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600"
                >
                  {isKo ? "오시는 길" : "Location"}
                </Link>
                <a
                  href="https://open.kakao.com/me/nol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                >
                  <MessageCircle className="mr-2" size={20} />
                  {isKo ? "카카오톡 문의하기" : "Inquiry"}
                </a>
              </motion.div>
            </div>
            <div className="relative h-64 md:h-auto">
               <ResponsiveImage
                src={`/images/room8.jpg`}
                alt="Studio NOL"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </motion.div>
      </Section>
    </>
  );
};

(PracticeRoom as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = getCommonStaticProps;

export default PracticeRoom;
