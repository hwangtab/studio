import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { ArrowRight, Music, Disc, Mic, Globe, Upload, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import SectionHeading from '../../components/ui/SectionHeading';
import MediaGallery from '../../components/ui/MediaGallery';
import Hero from '../../components/ui/Hero';
import Section from '../../components/ui/Section';
import BaseCard from '../../components/ui/BaseCard';
import PillNavLink from '../../components/ui/PillNavLink';
import LinkCard from '../../components/ui/LinkCard';
import CTASection from '../../components/ui/CTASection';

// Below-fold 컴포넌트는 코드 스플리팅으로 초기 번들에서 분리.
// ssr:true(기본)라 서버 렌더링 HTML은 그대로 나오고, 클라이언트 JS 청크만 지연 로드됨.
// → 초기 JS 다운로드/파싱/하이드레이션 비용 감소 (TBT 개선 기대).
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
import { getHomeData, type HomeData } from '../../data/home';
import { getFaqData } from '../../data/faq';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import { type Locale } from '../../lib/i18n';
import { createInViewEnterAnimation } from '../../utils/animationUtils';

import type { NextPageWithLayout } from '../../types';

const ICON_MAP: Record<string, React.ElementType> = {
  Disc,
  Mic,
  Globe,
  Music,
  Upload,
  GraduationCap,
};

// 페이지 하단 서비스 바로가기 — i18n 키 + 경로 매핑.
// 새 서비스 추가 시 이 배열에만 항목을 추가하면 nav가 자동으로 갱신된다.
const FOOTER_NAV_ITEMS = [
  { i18nKey: 'nav.weddingSong', path: '/wedding-song' },
  { i18nKey: 'nav.voiceActing', path: '/voice-acting' },
  { i18nKey: 'nav.lesson', path: '/lesson' },
  { i18nKey: 'nav.pricing', path: '/pricing' },
  { i18nKey: 'nav.stories', path: '/stories' },
] as const;

interface HomeProps {
  locale: Locale;
  homeData: HomeData;
  faqData: ReturnType<typeof getFaqData>;
}

const Home: NextPageWithLayout<HomeProps> = ({ locale, homeData, faqData }) => {
  const { heroContent, homeServices, studioImages, seo, localeUsps, featuredLinks } = homeData;
  const { t } = useTranslation('common', { lng: locale });

  const getLink = (path: string) => `/${locale}${path}`;
  const homeQuickAnswers = React.useMemo(() => faqData.slice(0, 3), [faqData]);
  const homeServicesMotionProps = createInViewEnterAnimation({ duration: 0.5 });

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        ogImage={heroContent.backgroundImage}
        ogImageAlt={heroContent.imageAlt}
        ogImageWidth={1280}
        ogImageHeight={720}
        includeSchema
        webPageType="WebSite"
        canonical={`/${locale}`}
        faqItems={faqData}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
        ]}
      />

      {/* 히어로 — darkCinematic, 두 개 orb로 분위기 연출 */}
      <Hero
        variant="darkCinematic"
        title={
          <>
            <span className="block mb-2">{heroContent.titlePrefix}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white">
              {heroContent.titleHighlight}
            </span>
            <span>{heroContent.titleSuffix}</span>
          </>
        }
        lead={heroContent.subtitle}
        primaryCta={{ label: heroContent.cta.reserve, href: getLink('/contact') }}
        secondaryCta={{ label: heroContent.cta.portfolio, href: getLink('/portfolio') }}
        orbs={[
          { color: 'mint', size: 720, top: '-160px', right: '-120px', opacity: 0.55 },
          { color: 'lavender', size: 560, bottom: '-180px', left: '-100px', opacity: 0.45 },
        ]}
      />

      {/* 스튜디오 갤러리 */}
      <Section tone="canvas">
        <SectionHeading title={t('home.sections.galleryTitle')} marginBottom="default" />
        <MediaGallery images={studioImages} locale={locale} />
      </Section>

      {/* Locale-specific USP block (zh, es, vi, th only) */}
      {localeUsps && locale !== 'ko' && (
        <Section tone="warm">
          <SectionHeading title={localeUsps.title} marginBottom="default" />
          <div className="max-w-4xl mx-auto space-y-6">
            {localeUsps.items.map((item: { heading: string; body: string }, index: number) => (
              <m.div
                key={item.heading}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <BaseCard>
                  <h3 className="font-display font-light text-display-md mb-3 text-ink dark:text-on-dark">
                    {item.heading}
                  </h3>
                  <p className="text-[15px] leading-[1.6] text-ink-muted-60 dark:text-on-dark-soft">
                    {item.body}
                  </p>
                </BaseCard>
              </m.div>
            ))}
          </div>
        </Section>
      )}

      {/* Featured This Month — curated internal links for non-KO locales */}
      {featuredLinks && featuredLinks.length > 0 && (
        <Section tone="canvas">
          <SectionHeading
            eyebrow="Featured"
            title={t('home.sections.featuredTitle', 'Featured This Month')}
            marginBottom="default"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredLinks.map((link, index) => (
              <LinkCard
                key={link.title}
                href={getLink(link.href)}
                title={link.title}
                description={link.description}
                badge={
                  link.type === 'portfolio'
                    ? t('home.featured.typePortfolio', 'Portfolio')
                    : link.type === 'story'
                      ? t('home.featured.typeStory', 'Story')
                      : t('home.featured.typePage', 'Page')
                }
                animateInView={{ delay: index * 0.08 }}
              />
            ))}
          </div>
        </Section>
      )}

      {/* 서비스 소개 */}
      <Section tone="warm">
        <SectionHeading
          eyebrow="Services"
          title={t('home.sections.servicesTitle')}
          marginBottom="default"
        />
        <m.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          {...homeServicesMotionProps}
        >
          {homeServices.map((service, index) => (
            <FeatureCard
              key={service.title}
              icon={ICON_MAP[service.icon as string] || Disc}
              title={service.title}
              description={service.description}
              href={getLink(service.link)}
              variant="highlight"
              delay={0.1 * (index + 1)}
              cta={
                <div className="inline-flex items-center text-[15px] font-medium hover:text-ink-muted-80 transition-colors duration-300">
                  {t('home.sections.servicesCta')}
                  <m.span
                    className="ml-1"
                    initial={{ x: 0 }}
                    whileHover={{ x: 5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ArrowRight size={14} aria-hidden="true" />
                  </m.span>
                </div>
              }
            />
          ))}
        </m.div>
      </Section>

      {/* 리뷰 */}
      <ReviewSection variant="default" locale={locale} />

      {/* FAQ — QuickAnswers는 above-the-fold 빠른 답변, FAQSection은 전체 항목.
          schema(JSON-LD)는 <SEO faqItems={faqData}>에서 단일로 생성하므로 중복 없음. */}
      <QuickAnswers
        items={homeQuickAnswers}
        title={t('home.faq.title')}
        subtitle={t('home.faq.subtitle')}
      />

      <FAQSection
        items={faqData}
        title={t('home.faq.title')}
        subtitle={t('home.faq.subtitle')}
      />

      {/* 서비스 바로가기 — 보조 nav. paddingY="sm"으로 보조 영역 리듬.
          prefetch=false (PillNavLink 기본값): 메인 LCP 측정 창에서
          5개 페이지 청크 동시 다운로드를 차단. */}
      <Section tone="canvas" paddingY="sm">
        <div className="flex flex-wrap justify-center gap-4">
          {FOOTER_NAV_ITEMS.map((item) => (
            <PillNavLink
              key={item.path}
              href={getLink(item.path)}
              label={t(item.i18nKey)}
            />
          ))}
        </div>
      </Section>

      {/* 하단 CTA */}
      <CTASection
        tone="deep"
        title={
          <>
            {t('home.cta.titleLine1')}<br />
            <span className="text-on-dark-soft">{t('home.cta.titleHighlight')}</span>
          </>
        }
        lead={
          <>
            {t('home.cta.subtitleLine1')}<br className="hidden md:block" />
            {t('home.cta.subtitleLine2')}
          </>
        }
        primary={{ label: t('home.cta.inquiry'), href: getLink('/contact') }}
        orbs={[
          { color: 'mint', size: 600, top: '-80px', right: '-100px', opacity: 0.4 },
          { color: 'lavender', size: 480, bottom: '-120px', left: '-80px', opacity: 0.35 },
        ]}
      />
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
