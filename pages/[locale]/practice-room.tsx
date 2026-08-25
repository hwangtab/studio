import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { Music, Shield, Star, MapPin, VolumeX, Wind, Zap, Sparkles, HelpCircle, Target, ShieldCheck, Gift } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import SectionHeading from '../../components/ui/SectionHeading';

// Below-fold 컴포넌트를 코드 스플리팅 — 초기 JS 번들에서 분리해 TBT 감소.
// ssr:true(기본) 유지로 SSR HTML은 그대로, 클라이언트 청크만 지연 로드.
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { PRACTICE_ROOM_RELATED_GUIDES, type PracticeRoomRelatedGuide } from '../../data/practiceRoomRelatedGuides';
import { generatePracticeRoomMonthlyRentSchema } from '../../utils/schema';
import { createFadeInAnimation, HOVER_SCALE, TRANSITION_STANDARD } from '../../utils/animationUtils';
import type { NextPageWithLayout } from '../../types';

// PriceLeader·SoundproofingShowcase·FacilitiesGrid는 별도 파일로 분리(2026-05-11).
// 1020 → ~800줄로 축소·관심사 분리·재사용성 확보.
import PriceLeader, { type PricingBadge } from '../../components/practice-room/PriceLeader';
import SoundproofingShowcase, { type SoundproofingItem } from '../../components/practice-room/SoundproofingShowcase';
import FacilitiesGrid, { type FacilityItem } from '../../components/practice-room/FacilitiesGrid';
import {
  BENEFIT_ICONS,
  BenefitCard,
  FeatureCard,
  PainPoint,
  TargetAudience,
  type BenefitItem,
} from '../../components/practice-room/PracticeRoomCards';
import RelatedGuidesSection from '../../components/practice-room/RelatedGuidesSection';
import RegionLinksSection from '../../components/practice-room/RegionLinksSection';
import ServiceLinksSection from '../../components/practice-room/ServiceLinksSection';
import {
  parsePricingBadges,
  parseResidentBenefits,
  parseTitleDescriptionItems,
} from '../../components/practice-room/contentItems';

interface PracticeRoomProps {
  locale: Locale;
  /** 음악연습실 hub-and-spoke 가이드 링크. ko에서만 채운다. */
  relatedGuides: PracticeRoomRelatedGuide[];
}

const PAIN_POINTS_ANIMATION = createFadeInAnimation();
const AUDIENCE_SECTION_ANIMATION = createFadeInAnimation();
const FEATURES_SECTION_ANIMATION = createFadeInAnimation();
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

  const residentBenefits = React.useMemo<BenefitItem[]>(
    () => parseResidentBenefits(t('practiceRoom.residentBenefits.items', { returnObjects: true })),
    [t]
  );

  const pricingBadges = React.useMemo<PricingBadge[]>(
    () => parsePricingBadges(t('practiceRoom.pricing.badges', { returnObjects: true })),
    [t]
  );

  const soundproofingItems = React.useMemo<SoundproofingItem[]>(
    () => parseTitleDescriptionItems(t('practiceRoom.soundproofing.items', { returnObjects: true })),
    [t]
  );

  const facilitiesItems = React.useMemo<FacilityItem[]>(
    () => parseTitleDescriptionItems(t('practiceRoom.facilities.items', { returnObjects: true })),
    [t]
  );

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

  return (
    <>
      <SEO
        locale={locale}
        title={t('practiceRoom.seo.title')}
        description={t('practiceRoom.seo.description')}
        keywords={t('practiceRoom.seo.keywords')}
        ogImage="/images/og-room8.webp"
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
            <span className="block">{t('practiceRoom.hero.subtitleLine1')}</span>
            <span className="block">{t('practiceRoom.hero.subtitleLine2')}</span>
            <span className="block">{t('practiceRoom.hero.subtitleLine3')}</span>
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
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="PracticeRoomHero"
            ctaId="practice_room_hero_kakao"
            label={t('practiceRoom.cta.inquiry')}
            phone={siteConfig.contact.phone}
            phoneCtaId="practice_room_hero_phone"
          />
        }
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
            <PainPoint icon={Wind} text={t('practiceRoom.painPoints.items.0')} locale={locale} />
            <PainPoint icon={VolumeX} text={t('practiceRoom.painPoints.items.1')} locale={locale} />
            <PainPoint icon={Wind} text={t('practiceRoom.painPoints.items.2')} locale={locale} />
            <PainPoint icon={Zap} text={t('practiceRoom.painPoints.items.3')} locale={locale} />
            <PainPoint icon={Sparkles} text={t('practiceRoom.painPoints.items.4')} locale={locale} />
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
            />
            <TargetAudience
              title={t('practiceRoom.audience.items.1.title')}
              description={t('practiceRoom.audience.items.1.description')}
              icon={Star}
            />
            <TargetAudience
              title={t('practiceRoom.audience.items.2.title')}
              description={t('practiceRoom.audience.items.2.description')}
              icon={Music}
            />
          </div>

          {/* 이미지 갤러리 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[2, 3, 4, 5].map((i) => (
              <m.div
                key={i}
                className="rounded-lg overflow-hidden shadow-md h-48"
                whileHover={{ ...HOVER_SCALE, transition: TRANSITION_STANDARD }}
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
            />

            <FeatureCard
              icon={Shield}
              title={t('practiceRoom.features.items.1.title')}
              description={t('practiceRoom.features.items.1.description')}
            />

            <FeatureCard
              icon={Star}
              title={t('practiceRoom.features.items.2.title')}
              description={t('practiceRoom.features.items.2.description')}
            />

            <FeatureCard
              icon={MapPin}
              title={t('practiceRoom.features.items.3.title')}
              description={t('practiceRoom.features.items.3.description')}
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
                  locale={locale}
                  calendarLinkLabel={residentBenefitsCalendarLabel}
                  calendarLinkUrl={residentBenefitsCalendarUrl}
                />
              ))}
            </div>
          </m.div>
        </Section>
      )}

      {/* 중간 전환 CTA — 히어로와 최하단 ContactCTA 사이(페이지의 ~70% 스크롤 구간)에
          클릭 가능한 전환 버튼이 없던 공백을 메운다(2026-08-04 매출 감사).
          만실이어도 문의는 입주 대기로 이어지므로(운영 방침) 대기 접수를 명시해
          "만실이면 문의해도 소용없겠지" 이탈을 막는다. */}
      <Section variant="default" className="py-12">
        <div className="max-w-2xl mx-auto text-center">
          <p className="typo-card-body text-gray-700 dark:text-gray-300 mb-6">
            {t('practiceRoom.midCta.note')}
          </p>
          <div className="flex justify-center">
            <HeroKakaoCta
              locale={locale}
              kakaoUrl={siteConfig.contact.kakaoUrl}
              component="PracticeRoomMidCta"
              ctaId="practice_room_mid_kakao"
              label={t('practiceRoom.cta.inquiry')}
              phone={siteConfig.contact.phone}
              phoneCtaId="practice_room_mid_phone"
              surface="onSurface"
            />
          </div>
        </div>
      </Section>

      <FAQSection
        items={practiceRoomFaqs}
        title={t('practiceRoom.faq.title')}
        subtitle={t('practiceRoom.faq.subtitle')}
        variant="alternate"
      />

      <ReviewSection variant="default" locale={locale} />

      <RelatedGuidesSection
        title={t('practiceRoom.relatedGuides.title')}
        guides={relatedGuides}
      />

      <RegionLinksSection locale={locale} />

      <ServiceLinksSection
        locale={locale}
        labels={{
          lesson: t('nav.lesson'),
          pricing: t('nav.pricing'),
          stories: t('nav.stories'),
          contact: t('nav.contact'),
        }}
      />

      <Section variant="default" className="py-16" defer>
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('practiceRoom.cta.titleLine1')}</span>
              <span className="block text-primary">{t('practiceRoom.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('practiceRoom.cta.subtitleLine1')}</span>
              <span className="block">{t('practiceRoom.cta.subtitleLine2')}</span>
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

  // 앵커 타이틀이 한국어 전용이므로 ko 허브에서만 렌더 (기존 동작 유지).
  const relatedGuides = locale === 'ko' ? PRACTICE_ROOM_RELATED_GUIDES : [];

  return buildPageStaticProps(
    locale,
    {
      relatedGuides,
    },
    { revalidate: 86400, i18nSections: ['practiceRoom'] }
  );
};

export default PracticeRoom;
