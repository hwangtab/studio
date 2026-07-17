import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { m } from 'framer-motion';
import { ArrowRight, Mic2, Music, Disc, Mic, Globe, Upload, GraduationCap, Video, ShieldCheck, Award } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import SectionHeading from '../../components/ui/SectionHeading';
import ImageHero from '../../components/common/ImageHero';
import MediaGallery from '../../components/ui/MediaGallery';
import { Section } from '../../components/ui/Section';

// Below-fold 섹션은 정적 import로 유지한다(과거 next/dynamic ssr:true 코드 스플리팅에서 전환).
// 이유: 이들은 ssr:true라 서버는 완전한 HTML을 내보내지만, 클라이언트는 청크가 도착하기
// 전 하이드레이션 첫 패스에서 Loadable을 null로 렌더한다. dev 빌드는 __NEXT_DATA__에
// dynamicIds를 싣지 않아 loadableReady가 하이드레이션을 게이트하지 못하므로, null 렌더로
// 뒤따르는 형제 섹션이 밀려 hydration mismatch가 발생했다. prod에서도 loadableReady가
// 해당 청크를 하이드레이션 임계경로에 두어 스플리팅의 TBT 이득은 사실상 없다. 정적 import는
// 서버·클라이언트 트리를 항상 동일한 동기 렌더로 만들어 불일치를 근본 제거한다.
import ReviewSection from '../../components/ui/ReviewSection';
import FAQSection from '../../components/ui/FAQSection';
import ContactCTA from '../../components/common/ContactCTA';
import { getHomeData, type HomeData } from '../../data/home';
import { getFaqData } from '../../data/faq';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { trackLeadEvent } from '../../utils/analytics';
import { createInViewEnterAnimation } from '../../utils/animationUtils';

import type { NextPageWithLayout } from '../../types';

const ICON_MAP: Record<string, React.ElementType> = {
  Disc,
  Mic,
  Globe,
  Music,
  Upload,
  GraduationCap,
  Video,
};

interface HomeProps {
  locale: Locale;
  homeData: HomeData;
  faqData: ReturnType<typeof getFaqData>;
}

const Home: NextPageWithLayout<HomeProps> = ({ locale, homeData, faqData }) => {
  const { heroContent, homeServices, studioImages, seo, localeUsps, producerCredibility } = homeData;
  const { t } = useTranslation('common', { lng: locale });


  // Helper to generate locale-aware links
  const getLink = (path: string) => `/${locale}${path}`;
  // 검증된 유일 전환 채널(카카오) — 히어로 1차 CTA를 폼이 아닌 카카오 직링크로.
  const kakaoUrl = getSiteConfig(locale).contact.kakaoUrl;
  const homeServicesMotionProps = createInViewEnterAnimation({ duration: 0.5 });

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        ogImage="/images/og-studio2.webp"
        ogImageAlt={heroContent.imageAlt}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        webPageType="WebPage"
        canonical={`/${locale}`}
        faqItems={faqData}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
        ]}
      />

      <ImageHero
        locale={locale}
        priority
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{heroContent.titlePrefix}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {heroContent.titleHighlight}
            </span>
            {heroContent.titleSuffix && (
              <span className="text-gray-100 drop-shadow-lg">{heroContent.titleSuffix}</span>
            )}
          </>
        }
        subtitle={heroContent.subtitle}
        backgroundImage={heroContent.backgroundImage}
        imageAlt={heroContent.imageAlt}
        minHeight="min-h-[100svh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        ctaButtons={
          <>
            {/* prefetch={false}: hero CTA가 LCP 측정 창 안에 있어 자동 prefetch가
                portfolio.json 등 무거운 SSG 데이터(>100KB)를 끌어와 TBT/대역폭 경쟁을
                유발. hover/focus 시 prefetch는 next/link 기본 휴리스틱으로 유지된다. */}
            {/* 1차 CTA — 검증된 전환 채널(카카오톡) 직링크. GA4 90일 실질 전환은
                카카오 클릭이 전부였고 폼은 전환 0이라, 마찰 큰 폼(/contact) 대신
                카카오 오픈채팅으로 직접 연결. */}
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackLeadEvent('lead_click_kakao', {
                  locale,
                  component: 'HomeHero',
                  cta_id: 'hero_primary_kakao',
                })
              }
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {heroContent.cta.reserve}
            </a>
            <Link
              href={getLink('/portfolio')}
              prefetch={false}
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-primary border-2 border-primary text-white font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
            >
              {heroContent.cta.portfolio}
            </Link>
          </>
        }
      />

      {/* 스튜디오 갤러리 섹션 */}
      <Section variant="default">
        <SectionHeading
          icon={Mic2}
          title={t('home.sections.galleryTitle')}
          className="mb-12"
        />
        <MediaGallery images={studioImages} locale={locale} />
      </Section>

      {/* Locale-specific USP/trust block — ko: 신뢰·전환 보강, 그 외: 외국 뮤지션 안내 */}
      {localeUsps && (
        <Section variant="alternate">
          <SectionHeading
            icon={locale === 'ko' ? ShieldCheck : Globe}
            title={localeUsps.title}
            className="mb-8"
          />
          <div className="max-w-4xl mx-auto space-y-6">
            {localeUsps.items.map((item: { heading: string; body: string }, index: number) => (
              <m.div
                key={item.heading}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700"
              >
                <h3 className="text-heading-4 font-title mb-3 text-primary">{item.heading}</h3>
                <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>
              </m.div>
            ))}
          </div>
        </Section>
      )}

      {/* 프로듀서 신뢰 스트립 — 그동안 /release-project에만 있던 실적(70+ 발매작·15년·
          2017 한국대중음악상)을 홈으로 승격해 첫 화면 신뢰도 보강. */}
      {producerCredibility && (
        <Section variant="default">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary mb-2">
              <Award size={18} aria-hidden="true" />
              {producerCredibility.eyebrow}
            </div>
            <h2 className="text-heading-3 font-title mb-1">{producerCredibility.name}</h2>
            <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-8 break-keep">
              {producerCredibility.tagline}
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {producerCredibility.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border border-gray-100 dark:border-gray-700"
                >
                  <div className="text-3xl font-extrabold text-primary tabular-nums">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 break-keep">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* 서비스 소개 섹션 */}
      <Section variant="alternate">
        <SectionHeading
          icon={Music}
          title={t('home.sections.servicesTitle')}
          className="mb-12"
        />
        <m.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          {...homeServicesMotionProps}
        >
          {homeServices.map((service) => (
            <FeatureCard
              key={service.title}
              icon={ICON_MAP[service.icon as string] || Disc}
              title={service.title}
              description={service.description}
              href={getLink(service.link)}
              variant="highlight"
              cta={
                <div className="inline-flex items-center typo-card-cta hover:text-primary-dark dark:hover:text-primary-light/80 transition-colors duration-300">
                  {t('home.sections.servicesCta')}
                  <span className="ml-1">
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              }
            />
          ))}
        </m.div>
      </Section>

      {/* 리뷰 섹션 */}
      <ReviewSection variant="default" locale={locale} />

      {/* FAQ 섹션 */}
      <FAQSection
        items={faqData}
        title={t('home.faq.title')}
        subtitle={t('home.faq.subtitle')}
        variant="alternate"
      />

      {/* 서비스 바로가기 — 6~7개 link(ko는 발매 pill 포함)가 메인 viewport에 들어오면 next/link 기본 prefetch가
          각 페이지의 SSG JSON·청크를 동시 다운로드한다. 메인 페이지 LCP/TBT 측정 창에
          체류하는 사용자에게는 가성비 나쁜 비용이라 prefetch={false}로 차단. */}
      <Section variant="default" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          {/* 발매 프로젝트 pill은 ko 전용 — nav.releaseProject는 하위메뉴 맥락 라벨이라
              비한국어에서 "Overview"로 해석돼 홈에서 맥락을 잃는다. 플래그십은 한국 인디
              아티스트 중심이고 비-ko 홈은 저트래픽이라 ko에만 노출한다. */}
          {locale === 'ko' && (
            <Link
              href={getLink('/release-project')}
              prefetch={false}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
            >
              {t('nav.releaseProject')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
          <Link
            href={getLink('/practice-room')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/wedding-song')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/voice-acting')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/lesson')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/pricing')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/stories')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* 하단 CTA 섹션 */}
      <Section variant="alternate" className="py-24">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('home.cta.titleLine1')}<br />
              <span className="text-primary">{t('home.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('home.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('home.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/hardware5.webp"
          imageAlt={heroContent.ctaImageAlt}
          primaryButtonLabel={t('home.cta.inquiry')}
          secondaryButtonLabel={t('home.cta.location')}
          headingAs="h3"
        />
      </Section>
    </div>
  );
};

Home.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const homeData = getHomeData(locale);
  const faqData = getFaqData(locale);

  return buildPageStaticProps(
    locale,
    {
      homeData,
      faqData,
    },
    { revalidate: 3600, i18nSections: ['home'] }
  );
};

export default Home;
