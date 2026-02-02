import React from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Phone, Mail, MessageCircle, MapPin, Music, Activity, Award, Headphones } from 'lucide-react';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
import FeatureCard from '../components/ui/FeatureCard';
import BaseCard from '../components/ui/BaseCard';
import ImageHero from '../components/common/ImageHero';
import { coreServices, productionProcess, advantages } from '../data/services';
import { SECTION_BG } from '../utils/sectionStyles';
import SectionHeading from '../components/ui/SectionHeading';

const About: NextPage = () => {

  return (
    <div className="overflow-visible">
      <SEO
        title="스튜디오 놀 소개 - 올인원 음악 프로덕션"
        description="한 곡의 아이디어가 완성된 앨범이 되기까지, 스튜디오 놀은 그 모든 과정의 동반자입니다. 녹음을 넘어 기획, 디자인, 유통, 홍보까지."
        keywords="스튜디오 놀 소개, 음반 제작 프로세스, 음악 프로덕션, 레코딩 스튜디오, 믹싱 마스터링, 음원 유통, 음악 기획, 아날로그 장비"
        canonical="https://studionol.co.kr/about"
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '소개', path: '/about' },
        ]}
      />
      <ImageHero
        {...{
          title: "스튜디오 놀",
          subtitle: (
            <>
              기획부터 유통, 홍보까지 함께하는{" "}
              <span className="whitespace-nowrap">올인원 프로덕션</span>
              <br />
              한 곡의 아이디어가 완성된 앨범이 되기까지, 스튜디오 놀은 그 모든 과정의 동반자입니다.
            </>
          ),
          backgroundImage: "/images/recording15.png",
          imageAlt: "스튜디오 놀 소개",
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/60 via-black/40 to-transparent",
        }}
      />

      <section className={`pt-16 pb-12 ${SECTION_BG.alternate}`}>
        <div className="container mx-auto px-4">
          <SectionHeading
            icon={Music}
            title={
              <>
                <span className="whitespace-nowrap">올인원 음악</span> 프로덕션 서비스
              </>
            }
            subtitle={
              <>
                앨범 기획부터 유통, 홍보까지 모든 과정을 한 곳에서 제공하여{" "}
                <span className="whitespace-nowrap">뮤지션의 비전을 실현하는 토털 솔루션을 제공합니다.</span>
                <br />
                개별 과정마다 전문가 연계로 최상의 결과물을 보장합니다.
              </>
            }
            className="mb-12"
          />

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

      <section className="pt-16 pb-12">
        <div className="container mx-auto px-4">
          <SectionHeading
            icon={Activity}
            title="종합 음반 제작 프로세스"
            subtitle={
              <>
                스튜디오 놀은 음반 제작의 모든 단계를 체계적으로 관리하여{" "}
                <span className="whitespace-nowrap">최고 품질의 결과물을 만들어냅니다.</span>
              </>
            }
            className="mb-12"
          />

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

      <section className={`pt-16 pb-12 ${SECTION_BG.highlight}`}>
        <div className="container mx-auto px-4">
          <SectionHeading
            icon={Award}
            title="스튜디오 놀의 차별점"
            subtitle={
              <>
                연신내에 위치한 원스톱 프로덕션 시스템으로{" "}
                <span className="whitespace-nowrap">아날로그 장비를 통한 따뜻하고 감칠맛 있는 사운드를 구현합니다.</span>
              </>
            }
            className="mb-12"
          />

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

      <section className={`pt-16 pb-12 ${SECTION_BG.alternate}`}>
        <div className="container mx-auto px-4">
          <SectionHeading
            icon={Headphones}
            title="연락 및 상담"
            subtitle="무료 프로덕션 상담을 제공해 드립니다. 언제든지 아래 연락처로 문의해 주세요."
            className="mb-12"
          />

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
                  title={
                    <>
                      당신의 음악 여정에<br />
                      <span className="text-primary">가장 믿음직한 파트너</span>
                    </>
                  }
                  subtitle={
                    <>
                      프로젝트의 규모와 상관없이 정성을 다합니다.<br className="hidden md:block" />
                      기획부터 최종 마스터링까지, 당신의 상상을 완벽한 사운드로 실현해드립니다.
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
                    <MessageCircle className="mr-2" size={20} />
                    카카오톡 문의하기
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
                  src="/images/hardware3.jpg"
                  alt="스튜디오 놀 프로덕션 환경"
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

export default About;

(About as any).hasHero = true;

export const getStaticProps = () => ({
  props: {},
});
