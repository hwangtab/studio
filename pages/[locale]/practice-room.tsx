import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { LucideIcon, Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, ShieldCheck, Mic, Globe2, Newspaper, Speaker, MessageCircle, HandCoins, ClipboardList, Wrench, Gift, Check, Trophy, CalendarDays, Lock, Wallet, ChevronDown, Layers, Volume2, Leaf, Sun, Thermometer, Droplets, Coffee, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import Hero from '../../components/ui/Hero';
import BaseCard from '../../components/ui/BaseCard';
import SectionHeading from '../../components/ui/SectionHeading';
import Section from '../../components/ui/Section';
import PillNavLink from '../../components/ui/PillNavLink';

// Below-fold 컴포넌트를 코드 스플리팅 — 초기 JS 번들에서 분리해 TBT 감소.
// ssr:true(기본) 유지로 SSR HTML은 그대로, 클라이언트 청크만 지연 로드.
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import { loadCommonResourceServer } from '../../lib/i18n.server';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { PRACTICE_ROOM_RELATED_SLUGS } from '../../data/practiceRoomRelatedSlugs';
import { getSchemaLanguage } from '../../utils/schemaGenerator';
import { createFadeInAnimation, HOVER_SCALE } from '../../utils/animationUtils';
import type { NextPageWithLayout } from '../../types';

const FeatureCard = ({ icon: Icon, title, description }: { icon: LucideIcon, title: string, description: string, delay?: number }) => (
  <BaseCard variant="default" hover className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-canvas-warm rounded-pill p-3 inline-flex mr-4">
        <Icon className="text-ink" size={24} aria-hidden="true" />
      </div>
      <h3 className="text-title-md text-ink dark:text-on-dark">{title}</h3>
    </div>
    <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">{description}</p>
  </BaseCard>
);

const PainPoint = ({ icon: Icon, text, locale = 'ko' }: { icon: LucideIcon, text: string, delay?: number, locale?: Locale }) => (
  <BaseCard variant="default" hover className="p-5 h-full">
    <div className="flex items-start">
      <div className="bg-canvas-warm p-3 rounded-pill mr-4 flex-shrink-0">
        <Icon size={20} className="text-ink" aria-hidden="true" />
      </div>
      <div>
        <p className={`text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] whitespace-normal ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>{text}</p>
      </div>
    </div>
  </BaseCard>
);

const TargetAudience = ({ title, description, icon: Icon }: { title: string, description: string, icon: LucideIcon, delay?: number }) => (
  <BaseCard variant="default" hover className="p-6 mb-4">
    <div className="flex items-center mb-2">
      <div className="bg-canvas-warm rounded-pill p-3 inline-flex mr-4">
        <Icon className="text-ink" size={24} aria-hidden="true" />
      </div>
      <h3 className="text-title-md text-ink dark:text-on-dark">{title}</h3>
    </div>
    <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">{description}</p>
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
  <BaseCard variant="default" hover className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-canvas-warm p-3 rounded-pill mr-4 flex-shrink-0">
        <Icon size={22} className="text-ink" aria-hidden="true" />
      </div>
      <h3 className="text-title-md text-ink dark:text-on-dark">{title}</h3>
    </div>
    {valueBadge && (
      <div className="mb-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-semibold bg-canvas-warm text-ink border border-hairline">
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
              className="text-ink mt-1 flex-shrink-0"
              size={16}
              aria-hidden="true"
            />
            <span
              className={`text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
            >
              {showLink ? (
                <>
                  {point.split(calendarLinkLabel)[0]}
                  <a
                    href={calendarLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline hover:text-ink-muted-80"
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

const PRICING_BADGE_ICONS: LucideIcon[] = [Wallet, Gift, Lock, CalendarDays];

interface PricingBadge {
  label: string;
  caption: string;
}

const PriceLeader = ({
  eyebrow,
  title,
  subtitle,
  priceLabel,
  priceValue,
  priceCaption,
  badges,
  note,
  locale,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  priceValue: string;
  priceCaption: string;
  badges: PricingBadge[];
  note: string;
  locale: Locale;
}) => (
  <Section tone="canvas" paddingY="sm">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-pill bg-canvas-deep text-on-dark text-sm font-semibold shadow-card">
          <Trophy size={14} aria-hidden="true" />
          {eyebrow}
        </span>
        <h2
          className={`font-display font-light text-display-xl text-ink dark:text-on-dark mt-4 mb-2 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
        >
          {title}
        </h2>
        <p className={`text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
          {subtitle}
        </p>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6 bg-canvas-warm rounded-card p-6 md:p-8 border border-hairline">
        <div className="text-center md:text-left md:border-r md:border-hairline md:pr-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted-60 mb-1">
            {priceLabel}
          </p>
          <p className="text-4xl md:text-5xl font-bold text-ink dark:text-on-dark leading-tight">
            {priceValue}
          </p>
          <p className="text-xs text-ink-muted-60 mt-2">
            {priceCaption}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {badges.map((badge, idx) => {
            const BadgeIcon = PRICING_BADGE_ICONS[idx] ?? Check;
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="bg-canvas-warm border border-hairline p-2 rounded-pill flex-shrink-0">
                  <BadgeIcon size={16} className="text-ink" aria-hidden="true" />
                </div>
                <div>
                  <p className={`font-semibold text-ink dark:text-on-dark ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {badge.label}
                  </p>
                  <p className={`text-xs text-ink-muted-60 dark:text-on-dark-soft ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {badge.caption}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className={`text-center text-xs text-ink-muted-60 dark:text-on-dark-soft mt-4 italic ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
        {note}
      </p>
    </div>
  </Section>
);

const SOUNDPROOFING_ICONS: LucideIcon[] = [Shield, Layers, Volume2, Leaf, Sparkles];

interface SoundproofingItem {
  title: string;
  description: string;
}

const SoundproofingShowcase = ({
  eyebrow,
  title,
  subtitle,
  items,
  locale,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: SoundproofingItem[];
  locale: Locale;
}) => (
  <Section tone="warm">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-pill bg-canvas-deep text-on-dark text-sm font-semibold shadow-card">
          <ShieldCheck size={14} aria-hidden="true" />
          {eyebrow}
        </span>
        <h2
          className={`font-display font-light text-display-xl text-ink dark:text-on-dark mt-4 mb-2 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
        >
          {title}
        </h2>
        <p className={`text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
          {subtitle}
        </p>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-center">
        <div className="rounded-hero overflow-hidden shadow-card aspect-[4/3] md:aspect-auto md:h-full">
          <ResponsiveImage
            src="/images/room5.webp"
            alt={title}
            className="w-full h-full object-cover"
            pictureClassName="block h-full"
            loading="lazy"
            sizes="(min-width: 768px) 42vw, 100vw"
            fill
          />
        </div>
        <ul className="space-y-4">
          {items.map((item, idx) => {
            const Icon = SOUNDPROOFING_ICONS[idx] ?? Shield;
            return (
              <li key={idx} className="flex items-start gap-3">
                <div className="bg-canvas-deep text-on-dark p-2.5 rounded-pill flex-shrink-0">
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <p
                    className={`font-semibold text-ink dark:text-on-dark mb-0.5 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
                  >
                    {item.title}
                  </p>
                  <p
                    className={`text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
                  >
                    {item.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  </Section>
);

const FACILITIES_ICONS: LucideIcon[] = [Sun, Thermometer, Wind, Lightbulb, Droplets, Coffee, ShieldCheck, MapPin];

interface FacilityItem {
  title: string;
  description: string;
}

const FacilityCard = ({
  icon: Icon,
  title,
  description,
  delay = 0,
  locale,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
  locale: Locale;
}) => (
  <BaseCard variant="default" hover className="p-5 h-full">
    <div className="flex items-start gap-3">
      <div className="bg-canvas-warm rounded-pill p-2.5 inline-flex flex-shrink-0">
        <Icon size={20} className="text-ink" aria-hidden="true" />
      </div>
      <div>
        <h3 className={`text-title-md text-ink dark:text-on-dark mb-1 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
          {title}
        </h3>
        <p className={`text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
          {description}
        </p>
      </div>
    </div>
  </BaseCard>
);

const FacilitiesGrid = ({
  title,
  subtitle,
  items,
  locale,
}: {
  title: string;
  subtitle: string;
  items: FacilityItem[];
  locale: Locale;
}) => (
  <Section tone="canvas">
    <SectionHeading
      eyebrow="Facilities"
      title={title}
      lead={subtitle}
    />
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, idx) => (
        <FacilityCard
          key={idx}
          icon={FACILITIES_ICONS[idx] ?? Sparkles}
          title={item.title}
          description={item.description}
          delay={0.04 * idx}
          locale={locale}
        />
      ))}
    </div>
  </Section>
);

interface PracticeRoomProps {
  locale: Locale;
  /** 초기 노출 32개 가이드의 서버 렌더 HTML. locale !== 'ko'면 빈 문자열. */
  relatedGuidesVisibleHtml: string;
  /** 접힘 상태로 렌더되는 나머지 가이드 HTML. 크롤러는 HTML로 그대로 탐색 가능. */
  relatedGuidesHiddenHtml: string;
  /** 접힘 안에 들어있는 가이드 개수 (0이면 더보기 토글 숨김). */
  relatedGuidesHiddenCount: number;
}

const PAIN_POINTS_ANIMATION = createFadeInAnimation();
const AUDIENCE_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.6 });
const FEATURES_SECTION_ANIMATION = createFadeInAnimation({ delay: 0.8 });
const RESIDENT_BENEFITS_ANIMATION = createFadeInAnimation();

const PracticeRoom: NextPageWithLayout<PracticeRoomProps> = ({
  locale,
  relatedGuidesVisibleHtml,
  relatedGuidesHiddenHtml,
  relatedGuidesHiddenCount,
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
      price: 360000,
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
        locale={locale}
        title={t('practiceRoom.seo.title')}
        description={t('practiceRoom.seo.description')}
        keywords={t('practiceRoom.seo.keywords')}
        ogImage="/images/room7.webp"
        ogImageAlt={t('practiceRoom.hero.alt')}
        ogImageWidth={1440}
        ogImageHeight={809}
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
      {/* Hero — lightEditorial with sky + mint orbs */}
      <Hero
        variant="lightEditorial"
        eyebrow={t('nav.practiceRoom')}
        title={t('practiceRoom.hero.title')}
        lead={t('practiceRoom.hero.subtitleLine1')}
        primaryCta={{ label: t('practiceRoom.cta.inquiry'), href: siteConfig.contact.kakaoUrl }}
        orbs={[
          { color: 'sky', size: 600, top: '-100px', right: '-80px', opacity: 0.4 },
          { color: 'mint', size: 500, bottom: '-150px', left: '-100px', opacity: 0.35 },
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
        tone="warm"
      />

      {/* 고민 섹션 */}
      <Section tone="canvas">
        <m.div {...painPointsAnimation}>
          <SectionHeading
            eyebrow="Pain Points"
            title={t('practiceRoom.painPoints.title')} marginBottom="tight"
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
      <Section tone="warm">
        <m.div {...audienceSectionAnimation}>
          <SectionHeading
            eyebrow="Who It's For"
            title={t('practiceRoom.audience.title')} marginBottom="tight"
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
                className="rounded-card overflow-hidden shadow-card h-48"
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

      <Section tone="canvas">
        <m.div {...featuresSectionAnimation}>
          <SectionHeading
            eyebrow="Features"
            title={t('practiceRoom.features.title')}
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
        <Section tone="warm">
          <m.div {...RESIDENT_BENEFITS_ANIMATION}>
            <SectionHeading
              eyebrow="Resident Benefits"
              title={t('practiceRoom.residentBenefits.title')}
              lead={t('practiceRoom.residentBenefits.subtitle')}
            />

            {/* 혜택 총가치 환산 — 월세 대비 제공 가치 강조 */}
            <div className="max-w-4xl mx-auto mb-12 rounded-card p-6 md:p-8 bg-canvas-warm border border-hairline">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0 text-center md:text-left">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-canvas-soft border border-hairline text-xs font-semibold text-ink mb-3">
                    <Sparkles size={12} aria-hidden="true" />
                    {t('practiceRoom.residentBenefits.valueSummary.eyebrow')}
                  </span>
                  <p className="text-4xl md:text-5xl font-bold text-ink dark:text-on-dark leading-tight">
                    {t('practiceRoom.residentBenefits.valueSummary.headline')}
                  </p>
                  <p className="text-xs text-ink-muted-60 dark:text-on-dark-soft mt-1">
                    {t('practiceRoom.residentBenefits.valueSummary.headlineCaption')}
                  </p>
                </div>
                <div className="md:border-l md:border-hairline md:pl-6 flex-1 text-center md:text-left">
                  <h3 className={`text-title-md text-ink dark:text-on-dark mb-2 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {t('practiceRoom.residentBenefits.valueSummary.title')}
                  </h3>
                  <p className={`text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {t('practiceRoom.residentBenefits.valueSummary.subtitle')}
                  </p>
                </div>
              </div>
              <p className={`text-xs text-ink-muted-60 dark:text-on-dark-soft mt-4 italic ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
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

      <ReviewSection tone="canvas" locale={locale} />

      {/* 관련 가이드 — Pillar→Cluster 내부 링크 (한국어 SEO)
          초기 32개 노출, 나머지는 <details> JS-free 접기 패턴.
          서버사이드 렌더 HTML이라 크롤러는 접힌 링크도 전부 탐색 가능.
          HTML 문자열은 getStaticProps에서 escapeHtml + 고정 slug 배열로 생성 — 외부 입력 없음. */}
      {locale === 'ko' && (
        <Section tone="warm" paddingY="sm">
          <div className="max-w-5xl mx-auto">
            <SectionHeading
              eyebrow="Related Guides"
              title={t('practiceRoom.relatedGuides.title')} marginBottom="tight"
            />
            {/* eslint-disable-next-line react/no-danger */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              dangerouslySetInnerHTML={{ __html: relatedGuidesVisibleHtml }}
            />
            {relatedGuidesHiddenCount > 0 && (
              <details className="mt-6 group">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-ink hover:text-ink-muted-80 dark:text-on-dark transition-colors">
                  <span className="group-open:hidden">
                    가이드 +{relatedGuidesHiddenCount}개 더 보기
                  </span>
                  <span className="hidden group-open:inline">접기</span>
                  <ChevronDown
                    size={16}
                    className="transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                {/* eslint-disable-next-line react/no-danger */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3"
                  dangerouslySetInnerHTML={{ __html: relatedGuidesHiddenHtml }}
                />
              </details>
            )}
          </div>
        </Section>
      )}

      {/* 관련 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section tone="canvas" paddingY="sm">
        <div className="flex flex-wrap justify-center gap-4">
          {[
            { i18nKey: 'nav.lesson', path: '/lesson' },
            { i18nKey: 'nav.pricing', path: '/pricing' },
            { i18nKey: 'nav.stories', path: '/stories' },
            { i18nKey: 'nav.contact', path: '/contact' },
          ].map((item) => (
            <PillNavLink
              key={item.path}
              href={`/${locale}${item.path}`}
              label={t(item.i18nKey)}
            />
          ))}
        </div>
      </Section>

      {/* Final CTA Section */}
      <Section tone="deep" orbs={[{ color: 'mint', size: 600, top: '-100px', right: '-80px', opacity: 0.5 }]} paddingY="default">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('practiceRoom.cta.titleLine1')}<br />
              <span>{t('practiceRoom.cta.titleHighlight')}</span>
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

  // 서버에서 "관련 가이드" 678개 링크의 HTML 문자열을 미리 생성해 클라이언트로 전달.
  // 초기 32개(visible) + 나머지(hidden)로 split — hidden은 <details>로 접힘.
  // 크롤러는 HTML 링크 그대로 탐색하므로 SEO 가치는 유지되고, 초기 뷰포트는 가벼워진다.
  // 동시에 i18n의 practiceRoom.relatedGuides.items 배열(17KB)을 __NEXT_DATA__에서
  // 제외해 페이로드를 줄인다.
  const VISIBLE_GUIDES = 32;
  let relatedGuidesVisibleHtml = '';
  let relatedGuidesHiddenHtml = '';
  let relatedGuidesHiddenCount = 0;

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
      const cls = 'inline-flex items-center justify-between gap-2 px-4 py-3 rounded-card border border-hairline text-sm font-medium text-ink-muted-80 hover:border-hairline-strong hover:text-ink transition-colors duration-200';
      const arrowSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
      const renderLink = (slug: string, idx: number): string => {
        const title = escapeHtml(items[idx] ?? slug);
        return `<a href="/ko/stories/${slug}" class="${cls}"><span>${title}</span>${arrowSvg}</a>`;
      };
      const total = PRACTICE_ROOM_RELATED_SLUGS.length;
      relatedGuidesVisibleHtml = PRACTICE_ROOM_RELATED_SLUGS
        .slice(0, VISIBLE_GUIDES)
        .map((slug, idx) => renderLink(slug, idx))
        .join('');
      if (total > VISIBLE_GUIDES) {
        relatedGuidesHiddenHtml = PRACTICE_ROOM_RELATED_SLUGS
          .slice(VISIBLE_GUIDES)
          .map((slug, idx) => renderLink(slug, idx + VISIBLE_GUIDES))
          .join('');
        relatedGuidesHiddenCount = total - VISIBLE_GUIDES;
      }
    }
  }

  const result = buildPageStaticProps(
    locale,
    {
      relatedGuidesVisibleHtml,
      relatedGuidesHiddenHtml,
      relatedGuidesHiddenCount,
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
