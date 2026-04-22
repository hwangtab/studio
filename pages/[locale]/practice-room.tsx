import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { LucideIcon, Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, HelpCircle, Target, ShieldCheck, ArrowRight, BookOpen, Mic, Globe2, Newspaper, Speaker, MessageCircle, HandCoins, ClipboardList, Wrench, Gift, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import BaseCard from '../../components/ui/BaseCard';
import SectionHeading from '../../components/ui/SectionHeading';

// Below-fold 컴포넌트를 코드 스플리팅 — 초기 JS 번들에서 분리해 TBT 감소.
// ssr:true(기본) 유지로 SSR HTML은 그대로, 클라이언트 청크만 지연 로드.
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import { loadCommonResourceServer } from '../../lib/i18n.server';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getReviews } from '../../data/reviews';
import { PRACTICE_ROOM_RELATED_SLUGS } from '../../data/practiceRoomRelatedSlugs';
import { getSchemaLanguage } from '../../utils/schemaGenerator';
import { createFadeInAnimation, HOVER_SCALE } from '../../utils/animationUtils';
import type { NextPageWithLayout } from '../../types';

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: LucideIcon, title: string, description: string, delay?: number }) => (
  <BaseCard variant="default" delay={delay} className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} aria-hidden="true" />
      </div>
      <h3 className="typo-card-title">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

const PainPoint = ({ icon: Icon, text, delay = 0, locale = 'ko' }: { icon: LucideIcon, text: string, delay?: number, locale?: Locale }) => (
  <BaseCard variant="default" delay={delay} className="p-5 h-full">
    <div className="flex items-start">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-full mr-4 text-white flex-shrink-0">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className={`typo-card-body whitespace-normal ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>{text}</p>
      </div>
    </div>
  </BaseCard>
);

const TargetAudience = ({ title, description, icon: Icon, delay = 0 }: { title: string, description: string, icon: LucideIcon, delay?: number }) => (
  <BaseCard variant="default" delay={delay} className="p-6 mb-4">
    <div className="flex items-center mb-2">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} aria-hidden="true" />
      </div>
      <h3 className="typo-card-subtitle">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

interface BenefitItem {
  title: string;
  points: string[];
}

const BenefitCard = ({
  icon: Icon,
  title,
  points,
  delay = 0,
  locale,
  calendarLinkLabel,
  calendarLinkUrl,
}: {
  icon: LucideIcon;
  title: string;
  points: string[];
  delay?: number;
  locale: Locale;
  calendarLinkLabel?: string;
  calendarLinkUrl?: string;
}) => (
  <BaseCard variant="default" delay={delay} className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-full mr-4 text-white flex-shrink-0">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="typo-card-title">{title}</h3>
    </div>
    <ul className="space-y-2">
      {points.map((point, idx) => {
        const showLink =
          calendarLinkLabel && calendarLinkUrl && point.includes(calendarLinkLabel);
        return (
          <li key={idx} className="flex items-start gap-2">
            <Check
              className="text-primary dark:text-primary-light mt-1 flex-shrink-0"
              size={16}
              aria-hidden="true"
            />
            <span
              className={`typo-card-body ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
            >
              {showLink ? (
                <>
                  {point.split(calendarLinkLabel)[0]}
                  <a
                    href={calendarLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary-dark"
                  >
                    {calendarLinkLabel}
                  </a>
                  {point.split(calendarLinkLabel)[1]}
                </>
              ) : (
                point
              )}
            </span>
          </li>
        );
      })}
    </ul>
  </BaseCard>
);

const BENEFIT_ICONS: LucideIcon[] = [
  Mic,
  Globe2,
  Newspaper,
  Speaker,
  MessageCircle,
  HandCoins,
  ClipboardList,
  Wrench,
];

interface PracticeRoomProps {
  locale: Locale;
  reviewsData: ReturnType<typeof getReviews>;
  /** 서버에서 미리 렌더한 관련 가이드 섹션 HTML (678개 내부 링크).
   *  React 트리에 포함되지 않아 하이드레이션 비용이 0이다.
   *  locale !== 'ko'면 빈 문자열. */
  relatedGuidesHtml: string;
}

const PAIN_POINTS_ANIMATION = createFadeInAnimation();
const AUDIENCE_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.6 });
const FEATURES_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.8 });
const RESIDENT_BENEFITS_ANIMATION = createFadeInAnimation();

const PracticeRoom: NextPageWithLayout<PracticeRoomProps> = ({ locale, reviewsData, relatedGuidesHtml }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const practiceRoomFaqs = React.useMemo(() => ([
    {
      question: t('practiceRoom.faq.items.0.q'),
      answer: t('practiceRoom.faq.items.0.a'),
    },
    {
      question: t('practiceRoom.faq.items.1.q'),
      answer: t('practiceRoom.faq.items.1.a'),
    },
    {
      question: t('practiceRoom.faq.items.2.q'),
      answer: t('practiceRoom.faq.items.2.a'),
    },
    {
      question: t('practiceRoom.faq.items.3.q'),
      answer: t('practiceRoom.faq.items.3.a'),
    },
    {
      question: t('practiceRoom.faq.items.4.q'),
      answer: t('practiceRoom.faq.items.4.a'),
    },
    {
      question: t('practiceRoom.faq.items.5.q'),
      answer: t('practiceRoom.faq.items.5.a'),
    },
    {
      question: t('practiceRoom.faq.items.6.q'),
      answer: t('practiceRoom.faq.items.6.a'),
    },
    {
      question: t('practiceRoom.faq.items.7.q'),
      answer: t('practiceRoom.faq.items.7.a'),
    },
  ]), [t]);

  const practiceRoomQuickAnswers = React.useMemo(() => practiceRoomFaqs.slice(0, 3), [practiceRoomFaqs]);

  const residentBenefits = React.useMemo<BenefitItem[]>(() => {
    const raw = t('practiceRoom.residentBenefits.items', { returnObjects: true });
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry): BenefitItem | null => {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof (entry as { title?: unknown }).title === 'string' &&
          Array.isArray((entry as { points?: unknown }).points)
        ) {
          const points = ((entry as { points: unknown[] }).points).filter(
            (p): p is string => typeof p === 'string'
          );
          return { title: (entry as { title: string }).title, points };
        }
        return null;
      })
      .filter((b): b is BenefitItem => b !== null);
  }, [t]);
  const residentBenefitsCalendarLabel = t('practiceRoom.residentBenefits.calendarLinkLabel');
  const residentBenefitsCalendarUrl = t('practiceRoom.residentBenefits.calendarLinkUrl');
  const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

  const practiceRoomSchema = React.useMemo(() => ({
    '@type': 'Service',
    name: t('practiceRoom.seo.title'),
    description: t('practiceRoom.seo.description'),
    inLanguage: schemaLanguage,
    serviceType: locale === 'ko' ? '음악연습실' : t('nav.practiceRoom'),
    areaServed: [
      { '@type': 'AdministrativeArea', name: locale === 'ko' ? '서울특별시' : 'Seoul' },
      { '@type': 'AdministrativeArea', name: locale === 'ko' ? '은평구' : 'Eunpyeong-gu' },
      { '@type': 'Neighborhood', name: 'Yeonsinnae' },
      { '@type': 'Neighborhood', name: 'Bulgwang' },
    ],
    location: {
      '@type': 'Place',
      name: siteConfig.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
        addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
        postalCode: '03424',
        addressCountry: 'KR',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 37.614353,
        longitude: 126.925887,
      },
    },
    provider: {
      '@type': 'Organization',
      '@id': `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
    url: `${siteConfig.url}/${locale}/practice-room`,
    hoursAvailable: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    offers: {
      '@type': 'Offer',
      name: locale === 'ko' ? '음악연습실 월정액 입주 프로그램' : 'Monthly Practice Room Residency Program',
      priceCurrency: 'KRW',
      price: 300000,
      availability: 'https://schema.org/InStock',
      url: `${siteConfig.url}/${locale}/practice-room`,
    },
  }), [t, siteConfig, locale, schemaLanguage]);
  const painPointsAnimation = PAIN_POINTS_ANIMATION;
  const audienceSectionAnimation = AUDIENCE_SECTION_ANIMATION;
  const featuresSectionAnimation = FEATURES_SECTION_ANIMATION;

  return (
    <>
      <SEO
        title={t('practiceRoom.seo.title')}
        description={t('practiceRoom.seo.description')}
        keywords={t('practiceRoom.seo.keywords')}
        ogImage="/images/room5.webp"
        ogImageAlt={t('practiceRoom.hero.alt')}
        ogImageWidth={1440}
        ogImageHeight={810}
        includeSchema={true}
        webPageType="ItemPage"
        canonical={`/${locale}/practice-room`}
        faqItems={practiceRoomFaqs}
        schema={practiceRoomSchema}
        reviewItems={reviewsData.filter((r) => (r as { categoryKey?: string }).categoryKey === 'practice')}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.practiceRoom'), path: `/${locale}/practice-room` },
        ]}
      />
      <ImageHero
        locale={locale}
        priority
        title={t('practiceRoom.hero.title')}
        subtitle={
          <>
            {t('practiceRoom.hero.subtitleLine1')}
            <br />
            {t('practiceRoom.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/room5.webp"
        imageAlt={t('practiceRoom.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.practiceRoom'), path: `/${locale}/practice-room` },
        ]}
      />

      <QuickAnswers
        title={t('practiceRoom.faq.title')}
        subtitle={t('practiceRoom.faq.subtitle')}
        items={practiceRoomQuickAnswers}
        variant="default"
      />

      {/* 고민 섹션 */}
      <Section variant="default" defer>
        <m.div {...painPointsAnimation}>
          <SectionHeading
            icon={HelpCircle}
            title={t('practiceRoom.painPoints.title')}
            className="mb-8"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <PainPoint icon={Wind} text={t('practiceRoom.painPoints.items.0')} delay={0.1} locale={locale} />
            <PainPoint icon={VolumeX} text={t('practiceRoom.painPoints.items.1')} delay={0.2} locale={locale} />
            <PainPoint icon={Wind} text={t('practiceRoom.painPoints.items.2')} delay={0.3} locale={locale} />
            <PainPoint icon={Zap} text={t('practiceRoom.painPoints.items.3')} delay={0.4} locale={locale} />
            <PainPoint icon={Sparkles} text={t('practiceRoom.painPoints.items.4')} delay={0.5} locale={locale} />
          </div>
        </m.div>
      </Section>

      {/* 타겟 오디언스 섹션 */}
      <Section variant="alternate" defer>
        <m.div {...audienceSectionAnimation}>
          <SectionHeading
            icon={Target}
            title={t('practiceRoom.audience.title')}
            className="mb-6"
            titleClassName="text-primary"
          />

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <TargetAudience
              title={t('practiceRoom.audience.items.0.title')}
              description={t('practiceRoom.audience.items.0.description')}
              icon={MapPin}
              delay={0.1}
            />
            <TargetAudience
              title={t('practiceRoom.audience.items.1.title')}
              description={t('practiceRoom.audience.items.1.description')}
              icon={Star}
              delay={0.2}
            />
            <TargetAudience
              title={t('practiceRoom.audience.items.2.title')}
              description={t('practiceRoom.audience.items.2.description')}
              icon={Music}
              delay={0.3}
            />
          </div>

          {/* 이미지 갤러리 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[2, 3, 4, 5].map((i) => (
              <m.div
                key={i}
                className="rounded-lg overflow-hidden shadow-md h-48"
                whileHover={HOVER_SCALE}
                transition={{ duration: 0.3 }}
              >
                <ResponsiveImage
                  src={`/images/room${i}.webp`}
                  alt={t(`practiceRoom.gallery.alt_${i}`)}
                  className="w-full h-full object-cover"
                  pictureClassName="block h-full"
                  loading="lazy"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  fill
                />
              </m.div>
            ))}
          </div>
        </m.div>
      </Section>

      <Section variant="default" defer>
        <m.div {...featuresSectionAnimation}>
          <SectionHeading
            icon={ShieldCheck}
            title={t('practiceRoom.features.title')}
            titleClassName="text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
            className="mb-12"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <FeatureCard
              icon={Music}
              title={t('practiceRoom.features.items.0.title')}
              description={t('practiceRoom.features.items.0.description')}
              delay={0.1}
            />

            <FeatureCard
              icon={Shield}
              title={t('practiceRoom.features.items.1.title')}
              description={t('practiceRoom.features.items.1.description')}
              delay={0.2}
            />

            <FeatureCard
              icon={Star}
              title={t('practiceRoom.features.items.2.title')}
              description={t('practiceRoom.features.items.2.description')}
              delay={0.3}
            />

            <FeatureCard
              icon={MapPin}
              title={t('practiceRoom.features.items.3.title')}
              description={t('practiceRoom.features.items.3.description')}
              delay={0.4}
            />
          </div>
        </m.div>
      </Section>

      {residentBenefits.length > 0 && (
        <Section variant="default" defer>
          <m.div {...RESIDENT_BENEFITS_ANIMATION}>
            <SectionHeading
              icon={Gift}
              title={t('practiceRoom.residentBenefits.title')}
              subtitle={t('practiceRoom.residentBenefits.subtitle')}
              titleClassName="text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
              className="mb-12"
            />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {residentBenefits.map((benefit, idx) => (
                <BenefitCard
                  key={idx}
                  icon={BENEFIT_ICONS[idx] ?? Sparkles}
                  title={benefit.title}
                  points={benefit.points}
                  delay={0.05 * idx}
                  locale={locale}
                  calendarLinkLabel={residentBenefitsCalendarLabel}
                  calendarLinkUrl={residentBenefitsCalendarUrl}
                />
              ))}
            </div>
          </m.div>
        </Section>
      )}

      <FAQSection
        items={practiceRoomFaqs}
        title={t('practiceRoom.faq.title')}
        subtitle={t('practiceRoom.faq.subtitle')}
        variant="alternate"
      />

      <ReviewSection variant="default" locale={locale} />

      {/* 관련 가이드 — Pillar→Cluster 내부 링크 (한국어 SEO) */}
      {locale === 'ko' && (
        <Section variant="default" className="py-10" defer>
          <div className="max-w-5xl mx-auto">
            <SectionHeading
              icon={BookOpen}
              title={t('practiceRoom.relatedGuides.title')}
              className="mb-6"
            />
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              // 678개 관련 가이드 링크 — 서버사이드에서 미리 HTML 문자열로 렌더링되어
              // React 트리에 포함되지 않음. 하이드레이션 비용 0. 크롤러는 HTML 링크 그대로 탐색.
              dangerouslySetInnerHTML={{ __html: relatedGuidesHtml }}
            />
          </div>
        </Section>
      )}

      {/* 관련 서비스 바로가기 */}
      <Section variant="alternate" className="py-10" defer>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/lesson`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/stories`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/contact`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.contact')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section variant="default" className="py-16" defer>
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('practiceRoom.cta.titleLine1')}<br />
              <span className="text-primary">{t('practiceRoom.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('practiceRoom.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('practiceRoom.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/room8.webp"
          imageAlt={t('practiceRoom.cta.imageAlt')}
          primaryButtonLabel={t('practiceRoom.cta.inquiry')}
          secondaryButtonLabel={t('practiceRoom.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

PracticeRoom.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const reviewsData = getReviews(locale);

  // 서버에서 "관련 가이드" 678개 링크의 HTML 문자열을 미리 생성해 클라이언트로 전달.
  // 동시에 i18n의 practiceRoom.relatedGuides.items 배열(17KB)을 __NEXT_DATA__에서
  // 제외해 페이로드를 줄인다. React 트리에 반영되지 않으므로 하이드레이션 비용도 0.
  let relatedGuidesHtml = '';
  if (locale === 'ko') {
    const full = loadCommonResourceServer('ko');
    const items = ((full as Record<string, unknown>).practiceRoom as
      | { relatedGuides?: { items?: unknown } }
      | undefined
    )?.relatedGuides?.items as string[] | undefined;

    if (Array.isArray(items)) {
      const escapeHtml = (s: string): string =>
        s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      const cls = 'inline-flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors duration-200';
      const arrowSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
      relatedGuidesHtml = PRACTICE_ROOM_RELATED_SLUGS
        .map((slug, idx) => {
          const title = escapeHtml(items[idx] ?? slug);
          return `<a href="/ko/stories/${slug}" class="${cls}"><span>${title}</span>${arrowSvg}</a>`;
        })
        .join('');
    }
  }

  const result = buildPageStaticProps(
    locale,
    {
      reviewsData,
      relatedGuidesHtml,
    },
    { revalidate: 86400, i18nSections: ['practiceRoom'] }
  );

  // i18nResources에서 relatedGuides.items 제거 — 클라이언트는 이 배열이 필요 없음.
  // title은 t()로 참조해야 하므로 practiceRoom.relatedGuides.title은 유지.
  const resources = (result as { props: { i18nResources?: Record<string, { common?: { practiceRoom?: { relatedGuides?: { items?: unknown } } } }> } }).props.i18nResources;
  const rg = resources?.[locale]?.common?.practiceRoom?.relatedGuides;
  if (rg && 'items' in rg) {
    delete rg.items;
  }

  return result;
};

export default PracticeRoom;
