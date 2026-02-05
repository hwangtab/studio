import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarCheck, ArrowRight, Mic2, Music, Sparkles, Disc, Mic, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../../utils/animationUtils';
import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import FAQSection from '../../components/ui/FAQSection';
import SectionHeading from '../../components/ui/SectionHeading';
import ImageHero from '../../components/common/ImageHero';
import MediaGallery from '../../components/ui/MediaGallery';
import ReviewSection from '../../components/ui/ReviewSection';
import ResponsiveImage from '../../components/ResponsiveImage';
import { Section } from '../../components/ui/Section';
import { getHomeData } from '../../data/home';
import { getFaqData } from '../../data/faq';
import { getReviews } from '../../data/reviews'; // Added import
import { locales, type Locale } from '../../lib/i18n';

const ICON_MAP: Record<string, React.ElementType> = {
  Disc,
  Mic,
  Globe,
};

interface HomeProps {
  locale: Locale;
  homeData: ReturnType<typeof getHomeData>;
  faqData: ReturnType<typeof getFaqData>;
  reviewsData: ReturnType<typeof getReviews>; // Added prop type
}

const Home = ({ locale, homeData, faqData, reviewsData }: HomeProps) => { // Added prop
  const { heroContent, homeServices, studioImages, seo } = homeData;
  const { t } = useTranslation('common', { lng: locale });

  // Helper to generate locale-aware links
  const getLink = (path: string) => `/${locale}${path}`;

  return (
    <div className="overflow-visible">
      <SEO
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={`https://studionol.co.kr/${locale}`}
        includeSchema
        faqItems={faqData}
        reviewItems={reviewsData} // Updated prop
      />

      <ImageHero
        locale={locale}
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
        <MediaGallery images={studioImages} />
      </Section>

      {/* 서비스 소개 섹션 */}
      <Section variant="alternate">
        <SectionHeading
          icon={Music}
          title={t('home.sections.servicesTitle')}
          className="mb-12"
        />
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          {...PAGE_CONTENT_ANIMATION}
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
                  <motion.span
                    className="ml-1"
                    initial={{ x: 0 }}
                    whileHover={{ x: 5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ArrowRight size={14} aria-hidden="true" />
                  </motion.span>
                </div>
              }
            />
          ))}
        </motion.div>
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

      {/* 하단 CTA 섹션 */}
      <Section variant="default" className="py-16">
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
                align="left"
                className="mb-8"
              />
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={getLink('/contact')}
                  className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-colors transition-shadow duration-300 border border-gray-100 dark:border-gray-600 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                >
                  {t('home.cta.location')}
                </Link>
                <a
                  href="https://open.kakao.com/me/nol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-colors transition-shadow duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
                >
                  <CalendarCheck className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                  <span className="min-w-0">{t('home.cta.inquiry')}</span>
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
                alt="Studio NOL Main Room"
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
      </Section>
    </div>
  );
};

(Home as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = locales.map((locale) => ({ params: { locale } }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = (params?.locale as Locale) || 'ko';
  const homeData = getHomeData(locale);
  const faqData = getFaqData(locale);
  const reviewsData = getReviews(locale); // Added fetch

  return {
    props: {
      locale,
      homeData,
      faqData,
      reviewsData, // Added to props
    },
  };
};

export default Home;
