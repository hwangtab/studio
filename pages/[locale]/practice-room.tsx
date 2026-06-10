import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, HelpCircle, Target, ShieldCheck, ArrowRight, BookOpen, Mic, Globe2, Newspaper, Speaker, MessageCircle, HandCoins, ClipboardList, Wrench, Gift, Check, ChevronDown } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import BaseCard from '../../components/ui/BaseCard';
import SectionHeading from '../../components/ui/SectionHeading';
import type { LucideIcon } from '@/lib/lucide-icons';

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
import { PRACTICE_ROOM_RELATED_SLUGS } from '../../data/practiceRoomRelatedSlugs';
import { PRACTICE_ROOM_REGION_LPS, PRACTICE_ROOM_REGION_GROUP_LABELS } from '../../data/practiceRoomRegionLPs';
import { generatePracticeRoomMonthlyRentSchema } from '../../utils/schemaGenerator';
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
  valueBadge?: string;
}

const BenefitCard = ({
  icon: Icon,
  title,
  points,
  valueBadge,
  delay = 0,
  locale,
  calendarLinkLabel,
  calendarLinkUrl,
}: {
  icon: LucideIcon;
  title: string;
  points: string[];
  valueBadge?: string;
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
    {valueBadge && (
      <div className="mb-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary/10 to-secondary/10 text-primary dark:text-primary-light border border-primary/20">
          <Sparkles size={12} aria-hidden="true" />
          {valueBadge}
        </span>
      </div>
    )}
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

// PriceLeader·SoundproofingShowcase·FacilitiesGrid는 별도 파일로 분리(2026-05-11).
// 1020 → ~800줄로 축소·관심사 분리·재사용성 확보.
import PriceLeader, { type PricingBadge } from '../../components/practice-room/PriceLeader';
import SoundproofingShowcase, { type SoundproofingItem } from '../../components/practice-room/SoundproofingShowcase';
import FacilitiesGrid, { type FacilityItem } from '../../components/practice-room/FacilitiesGrid';

interface PracticeRoomProps {
  locale: Locale;
  /** 음악연습실 hub-and-spoke 가이드 링크. ko에서만 채운다. */
  relatedGuides: Array<{ slug: string; title: string }>;
}

const PAIN_POINTS_ANIMATION = createFadeInAnimation();
const AUDIENCE_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.6 });
const FEATURES_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.8 });
const RESIDENT_BENEFITS_ANIMATION = createFadeInAnimation();

const PracticeRoom: NextPageWithLayout<PracticeRoomProps> = ({
  locale,
  relatedGuides,
}) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const practiceRoomFaqs = React.useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        question: t(`practiceRoom.faq.items.${i}.q`),
        answer: t(`practiceRoom.faq.items.${i}.a`),
      })),
    [t]
  );

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
          const vb = (entry as { valueBadge?: unknown }).valueBadge;
          return {
            title: (entry as { title: string }).title,
            points,
            valueBadge: typeof vb === 'string' ? vb : undefined,
          };
        }
        return null;
      })
      .filter((b): b is BenefitItem => b !== null);
  }, [t]);

  const pricingBadges = React.useMemo<PricingBadge[]>(() => {
    const raw = t('practiceRoom.pricing.badges', { returnObjects: true });
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry): PricingBadge | null => {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof (entry as { label?: unknown }).label === 'string' &&
          typeof (entry as { caption?: unknown }).caption === 'string'
        ) {
          return {
            label: (entry as { label: string }).label,
            caption: (entry as { caption: string }).caption,
          };
        }
        return null;
      })
      .filter((b): b is PricingBadge => b !== null);
  }, [t]);
  const soundproofingItems = React.useMemo<SoundproofingItem[]>(() => {
    const raw = t('practiceRoom.soundproofing.items', { returnObjects: true });
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry): SoundproofingItem | null => {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof (entry as { title?: unknown }).title === 'string' &&
          typeof (entry as { description?: unknown }).description === 'string'
        ) {
          return {
            title: (entry as { title: string }).title,
            description: (entry as { description: string }).description,
          };
        }
        return null;
      })
      .filter((x): x is SoundproofingItem => x !== null);
  }, [t]);

  const facilitiesItems = React.useMemo<FacilityItem[]>(() => {
    const raw = t('practiceRoom.facilities.items', { returnObjects: true });
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry): FacilityItem | null => {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof (entry as { title?: unknown }).title === 'string' &&
          typeof (entry as { description?: unknown }).description === 'string'
        ) {
          return {
            title: (entry as { title: string }).title,
            description: (entry as { description: string }).description,
          };
        }
        return null;
      })
      .filter((x): x is FacilityItem => x !== null);
  }, [t]);

  const residentBenefitsCalendarLabel = t('practiceRoom.residentBenefits.calendarLinkLabel');
  const residentBenefitsCalendarUrl = t('practiceRoom.residentBenefits.calendarLinkUrl');

  // 21개 dedicated 지역 LP와 동일한 generatePracticeRoomMonthlyRentSchema 사용 —
  // areaServed 26개(행정구 6 + Place 21), priceValidUntil, priceSpecification,
  // eligibleRegion 등 풀 디테일 자동 생성. inline 스키마(areaServed 4개·Offer 단순)
  // 보다 SERP·AI에 노출되는 정보 풍부해 hub 페이지 정합성 강화.
  const practiceRoomSchema = React.useMemo(
    () => generatePracticeRoomMonthlyRentSchema(`${siteConfig.url}/${locale}/practice-room`, locale),
    [siteConfig.url, locale]
  );
  const painPointsAnimation = PAIN_POINTS_ANIMATION;
  const audienceSectionAnimation = AUDIENCE_SECTION_ANIMATION;
  const featuresSectionAnimation = FEATURES_SECTION_ANIMATION;
  const VISIBLE_GUIDES = 32;
  const visibleRelatedGuides = relatedGuides.slice(0, VISIBLE_GUIDES);
  const hiddenRelatedGuides = relatedGuides.slice(VISIBLE_GUIDES);
  const relatedGuideLinkClassName = 'inline-flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors duration-200';

  return (
    <>
      <SEO
        locale={locale}
        title={t('practiceRoom.seo.title')}
        description={t('practiceRoom.seo.description')}
        keywords={t('practiceRoom.seo.keywords')}
        ogImage="/images/og-room7.webp"
        ogImageAlt={t('practiceRoom.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema={true}
        webPageType="ItemPage"
        canonical={`/${locale}/practice-room`}
        faqItems={practiceRoomFaqs}
        schema={practiceRoomSchema}
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
            <br />
            {t('practiceRoom.hero.subtitleLine3')}
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

      {pricingBadges.length > 0 && (
        <PriceLeader
          eyebrow={t('practiceRoom.pricing.eyebrow')}
          title={t('practiceRoom.pricing.title')}
          subtitle={t('practiceRoom.pricing.subtitle')}
          priceLabel={t('practiceRoom.pricing.priceLabel')}
          priceValue={t('practiceRoom.pricing.priceValue')}
          priceCaption={t('practiceRoom.pricing.priceCaption')}
          badges={pricingBadges}
          note={t('practiceRoom.pricing.note')}
          locale={locale}
        />
      )}

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

      {soundproofingItems.length > 0 && (
        <SoundproofingShowcase
          eyebrow={t('practiceRoom.soundproofing.eyebrow')}
          title={t('practiceRoom.soundproofing.title')}
          subtitle={t('practiceRoom.soundproofing.subtitle')}
          items={soundproofingItems}
          locale={locale}
        />
      )}

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

      {facilitiesItems.length > 0 && (
        <FacilitiesGrid
          title={t('practiceRoom.facilities.title')}
          subtitle={t('practiceRoom.facilities.subtitle')}
          items={facilitiesItems}
          locale={locale}
        />
      )}

      {residentBenefits.length > 0 && (
        <Section variant="default" defer>
          <m.div {...RESIDENT_BENEFITS_ANIMATION}>
            <SectionHeading
              icon={Gift}
              title={t('practiceRoom.residentBenefits.title')}
              subtitle={t('practiceRoom.residentBenefits.subtitle')}
              titleClassName="text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
              className="mb-10"
            />

            {/* 혜택 총가치 환산 — 월세 대비 제공 가치 강조 */}
            <div className="max-w-4xl mx-auto mb-12 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border border-primary/20">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0 text-center md:text-left">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 text-xs font-semibold text-primary dark:text-primary-light mb-3">
                    <Sparkles size={12} aria-hidden="true" />
                    {t('practiceRoom.residentBenefits.valueSummary.eyebrow')}
                  </span>
                  <p className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent leading-tight">
                    {t('practiceRoom.residentBenefits.valueSummary.headline')}
                  </p>
                  <p className="typo-caption text-gray-600 dark:text-gray-400 mt-1">
                    {t('practiceRoom.residentBenefits.valueSummary.headlineCaption')}
                  </p>
                </div>
                <div className="md:border-l md:border-primary/20 md:pl-6 flex-1 text-center md:text-left">
                  <h3 className={`typo-card-subtitle font-bold text-gray-900 dark:text-gray-100 mb-2 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {t('practiceRoom.residentBenefits.valueSummary.title')}
                  </h3>
                  <p className={`typo-card-body text-gray-700 dark:text-gray-300 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {t('practiceRoom.residentBenefits.valueSummary.subtitle')}
                  </p>
                </div>
              </div>
              <p className={`typo-caption text-gray-500 dark:text-gray-400 mt-4 italic ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                {t('practiceRoom.residentBenefits.valueSummary.note')}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {residentBenefits.map((benefit, idx) => (
                <BenefitCard
                  key={idx}
                  icon={BENEFIT_ICONS[idx] ?? Sparkles}
                  title={benefit.title}
                  points={benefit.points}
                  valueBadge={benefit.valueBadge}
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

      {/* 관련 가이드 — Pillar→Cluster 내부 링크 (한국어 SEO).
          초기 32개 노출, 나머지는 <details> JS-free 접기 패턴.
          JSX로 SSR되어 크롤러는 접힌 링크도 탐색 가능하고, props에는 slug/title만 전달해
          __NEXT_DATA__ payload가 커지지 않도록 한다. */}
      {visibleRelatedGuides.length > 0 && (
        <Section variant="default" className="py-10" defer>
          <div className="max-w-5xl mx-auto">
            <SectionHeading
              icon={BookOpen}
              title={t('practiceRoom.relatedGuides.title')}
              className="mb-6"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {visibleRelatedGuides.map((guide, idx) => (
                <Link
                  key={`${guide.slug}-visible-${idx}`}
                  href={`/ko/stories/${guide.slug}`}
                  className={relatedGuideLinkClassName}
                >
                  <span>{guide.title}</span>
                  <ArrowRight size={14} className="flex-shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
            {hiddenRelatedGuides.length > 0 && (
              <details className="mt-6 group">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-primary hover:text-primary-dark dark:text-primary-light transition-colors">
                  <span className="group-open:hidden">
                    가이드 +{hiddenRelatedGuides.length}개 더 보기
                  </span>
                  <span className="hidden group-open:inline">접기</span>
                  <ChevronDown
                    size={16}
                    className="transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {hiddenRelatedGuides.map((guide, idx) => (
                    <Link
                      key={`${guide.slug}-hidden-${idx}`}
                      href={`/ko/stories/${guide.slug}`}
                      className={relatedGuideLinkClassName}
                    >
                      <span>{guide.title}</span>
                      <ArrowRight size={14} className="flex-shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </div>
        </Section>
      )}

      {/* 지역별 음악연습실 hub-and-spoke — 21개 인접 지역 dedicated LP 그리드.
          Google이 'practice-room' hub와 21개 spoke의 관계를 명확히 인식해 권역 SERP
          부스트. ko에서만 노출(다국어 사용자에겐 한국 음악연습실 시장이 비대상). */}
      {locale === 'ko' && (
        <Section variant="alternate" className="py-10" defer>
          <div className="max-w-5xl mx-auto">
            <SectionHeading
              icon={MapPin}
              title="지역별 음악연습실 안내"
              className="mb-2"
            />
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
              연신내 동명여고 옆 — 인근 21개 지역에서의 동선·거리 한눈에
            </p>
            {/* 21개 인접 지역명 노출 — hub 섹션의 카드 메타(data 파일)는 검색엔진
                이 정적 i18n 텍스트가 아니라 SEO 신호가 약하므로, 본문에 명시적 텍스트로
                전체 지역을 한 줄 나열해 long-tail 지역 검색 인덱싱 강화. */}
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              연신내 · 불광 · 대조동 · 녹번 · 독바위 · 구산 · 역촌 · 응암 · 새절 · 증산 · 상암 · 서대문 · 구파발 · 지축 · 삼송 · 원흥 · 원당 · 덕양구 · 고양시 · 일산 · 은평구
            </p>
            <div className="space-y-6">
              {(['walk', 'eunpyeong', 'seodaemun', 'goyang'] as const).map((group) => {
                const items = PRACTICE_ROOM_REGION_LPS.filter((lp) => lp.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <h3 className="text-sm font-bold text-primary dark:text-primary-light mb-3 uppercase tracking-wide">
                      {PRACTICE_ROOM_REGION_GROUP_LABELS[group]}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {items.map((lp) => (
                        <Link
                          key={lp.slug}
                          href={`/${locale}/stories/${lp.slug}`}
                          prefetch={false}
                          className="group block px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary-light hover:shadow-md transition-all duration-200"
                        >
                          <div className="font-semibold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary-light transition-colors">
                            {lp.region} 음악연습실
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {lp.distance}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* 관련 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section variant="alternate" className="py-10" defer>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/lesson`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/stories`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/contact`}
            prefetch={false}
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

  let relatedGuides: Array<{ slug: string; title: string }> = [];

  if (locale === 'ko') {
    const full = loadCommonResourceServer('ko');
    const items = ((full as Record<string, unknown>).practiceRoom as
      | { relatedGuides?: { items?: unknown } }
      | undefined
    )?.relatedGuides?.items as string[] | undefined;

    if (Array.isArray(items)) {
      relatedGuides = PRACTICE_ROOM_RELATED_SLUGS.map((slug, idx) => ({
        slug,
        title: items[idx] ?? slug,
      }));
    }
  }

  const result = buildPageStaticProps(
    locale,
    {
      relatedGuides,
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
