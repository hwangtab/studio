import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { ArrowRight, Mic2, Music, Disc, Mic, Globe, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import SectionHeading from '../../components/ui/SectionHeading';
import ImageHero from '../../components/common/ImageHero';
import MediaGallery from '../../components/ui/MediaGallery';
import { Section } from '../../components/ui/Section';

// Below-fold 컴포넌트는 코드 스플리팅으로 초기 번들에서 분리.
// ssr:true(기본)라 서버 렌더링 HTML은 그대로 나오고, 클라이언트 JS 청크만 지연 로드됨.
// → 초기 JS 다운로드/파싱/하이드레이션 비용 감소 (TBT 개선 기대).
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
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

      <ImageHero
        locale={locale}
        priority
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
              href={getLink('/contact')}
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {heroContent.cta.reserve}
            </Link>
            <Link
              href={getLink('/portfolio')}
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

      {/* Locale-specific USP block (zh, es, vi, th only) */}
      {localeUsps && locale !== 'ko' && (
        <Section variant="alternate">
          <SectionHeading
            icon={Globe}
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
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700"
              >
                <h3 className="text-heading-4 font-title mb-3 text-primary">{item.heading}</h3>
                <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>
              </m.div>
            ))}
          </div>
        </Section>
      )}

      {/* Featured This Month — curated internal links for non-KO locales */}
      {featuredLinks && featuredLinks.length > 0 && (
        <Section variant="default">
          <SectionHeading
            icon={Sparkles}
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
                  className="group block bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {link.type === 'portfolio' ? t('home.featured.typePortfolio', 'Portfolio') : link.type === 'story' ? t('home.featured.typeStory', 'Story') : t('home.featured.typePage', 'Page')}
                    </span>
                    <ArrowRight size={16} className="text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" aria-hidden="true" />
                  </div>
                  <h3 className="text-heading-5 font-title mb-2 text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors duration-300">
                    {link.title}
                  </h3>
                  <p className="typo-card-body text-gray-600 dark:text-gray-300">{link.description}</p>
                </Link>
              </m.div>
            ))}
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
                <div className="inline-flex items-center typo-card-cta hover:text-primary-dark dark:hover:text-primary-light/80 transition-colors duration-300">
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

      {/* FAQ 섹션 */}
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

      {/* 서비스 바로가기 */}
      <Section variant="default" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={getLink('/wedding-song')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/voice-acting')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/lesson')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/pricing')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={getLink('/stories')}
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
