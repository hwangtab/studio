import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { ArrowRight, Music, Disc, Mic, Globe, Upload, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import SectionHeading from '../../components/ui/SectionHeading';
import MediaGallery from '../../components/ui/MediaGallery';
import Hero from '../../components/ui/Hero';
import Section from '../../components/ui/Section';

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

interface HomeProps {
  locale: Locale;
  homeData: HomeData;
  faqData: ReturnType<typeof getFaqData>;
}

const Home: NextPageWithLayout<HomeProps> = ({ locale, homeData, faqData }) => {
  const { heroContent, homeServices, studioImages, seo, localeUsps, featuredLinks } = homeData;
  const { t } = useTranslation('common', { lng: locale });


  // Helper to generate locale-aware links
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

      {/* 히어로 — darkCinematic 배리언트, 두 개 orb로 분위기 연출 */}
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

      {/* 스튜디오 갤러리 섹션 */}
      <Section tone="canvas">
        <SectionHeading
          title={t('home.sections.galleryTitle')}
          className="mb-12"
        />
        <MediaGallery images={studioImages} locale={locale} />
      </Section>

      {/* Locale-specific USP block (zh, es, vi, th only) */}
      {localeUsps && locale !== 'ko' && (
        <Section tone="warm">
          <SectionHeading
            title={localeUsps.title}
            className="mb-8"
          />
          <div className="max-w-4xl mx-auto space-y-6">
            {localeUsps.items.map((item: { heading: string; body: string }, index: number) => (
              <m.div
                key={item.heading}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-canvas border border-hairline rounded-card p-6 shadow-card"
              >
                <h3 className="font-display font-light text-display-md mb-3 text-ink">{item.heading}</h3>
                <p className="text-[15px] leading-[1.6] text-ink-muted-60">{item.body}</p>
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
            className="mb-8"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredLinks.map((link, index) => (
              <m.div
                key={link.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <Link
                  href={getLink(link.href)}
                  prefetch={false}
                  className="group block"
                >
                  <div className="bg-canvas border border-hairline rounded-card p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium bg-ink/[0.07] text-ink-muted-60">
                        {link.type === 'portfolio' ? t('home.featured.typePortfolio', 'Portfolio') : link.type === 'story' ? t('home.featured.typeStory', 'Story') : t('home.featured.typePage', 'Page')}
                      </span>
                      <ArrowRight size={16} className="text-ink-muted-40 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" aria-hidden="true" />
                    </div>
                    <h3 className="font-display font-light text-title-md mb-2 text-ink group-hover:text-ink-muted-80 transition-colors duration-300">
                      {link.title}
                    </h3>
                    <p className="text-[15px] leading-[1.6] text-ink-muted-60">{link.description}</p>
                  </div>
                </Link>
              </m.div>
            ))}
          </div>
        </Section>
      )}

      {/* 서비스 소개 섹션 */}
      <Section tone="warm">
        <SectionHeading
          eyebrow="Services"
          title={t('home.sections.servicesTitle')}
          className="mb-12"
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

      {/* 리뷰 섹션 */}
      <ReviewSection variant="default" locale={locale} />

      {/* FAQ 섹션 — 두 컴포넌트의 표시 데이터가 의도적으로 겹친다.
          QuickAnswers: 첫 3개 항목을 above-the-fold 가까이서 빠르게 답변
          FAQSection: 전체 항목을 카테고리·접힘 형태로 노출
          schema(JSON-LD)는 <SEO faqItems={faqData}>에서 단일로 생성하므로
          중복 마크업 없음. 시각적 중복은 conversion-focused UX 트레이드오프. */}
      <QuickAnswers
        items={homeQuickAnswers}
        title={t('home.faq.title')}
        subtitle={t('home.faq.subtitle')}
        variant="default"
      />

      <FAQSection
        items={faqData}
        title={t('home.faq.title')}
        subtitle={t('home.faq.subtitle')}
        variant="alternate"
      />

      {/* 서비스 바로가기 — 5개 link가 메인 viewport에 들어오면 next/link 기본 prefetch가
          각 페이지의 SSG JSON·청크를 동시 다운로드한다. 메인 페이지 LCP/TBT 측정 창에
          체류하는 사용자에게는 가성비 나쁜 비용이라 prefetch={false}로 차단. */}
      <Section tone="canvas" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={getLink('/wedding-song')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-medium hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/voice-acting')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-medium hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/lesson')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-medium hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/pricing')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-medium hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/stories')}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-medium hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* 하단 CTA 섹션 — deep tone (dark cinematic, 라이트모드에서도 다크) */}
      <Section
        tone="deep"
        orbs={[
          { color: 'mint', size: 600, top: '-80px', right: '-100px', opacity: 0.4 },
          { color: 'lavender', size: 480, bottom: '-120px', left: '-80px', opacity: 0.35 },
        ]}
        className="py-24"
      >
        <div className="text-center max-w-2xl mx-auto">
          <SectionHeading
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
            align="center"
            as="h2"
          />
          <Link
            href={getLink('/contact')}
            prefetch={false}
            className="inline-flex h-14 px-7 items-center rounded-pill bg-white text-ink font-medium hover:bg-on-dark-soft transition-all"
          >
            {t('home.cta.inquiry')}
          </Link>
        </div>
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
