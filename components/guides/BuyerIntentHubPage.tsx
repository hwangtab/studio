import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, CheckCircle2, Sparkles, Users } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import SEO from '../SEO';
import ImageHero from '../common/ImageHero';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';
import PricingCard from '../ui/PricingCard';
import StoryCard from '../StoryCard';
import PortfolioMiniCard from '../ui/PortfolioMiniCard';
import { STORY_CATEGORY_KEYS } from '../../lib/storyCategories';
import type { Locale } from '../../lib/i18n';
import type { StoryCardData } from '../../types/story';
import type { PortfolioItem } from '../../types/data';
import type { BuyerIntentHub } from '../../data/buyerIntentHubs';
import type { getPricingData } from '../../data/pricing';

const FAQSection = dynamic(() => import('../ui/FAQSection'));
const ContactCTA = dynamic(() => import('../common/ContactCTA'));

type PricingData = ReturnType<typeof getPricingData>;
type SpecialPackage = PricingData['specialPackages'][number];
type RecordingOffer = PricingData['recordingOffers'][number];
type MixingOffer = PricingData['mixingOffers'][number];
type AnyPackage = SpecialPackage | RecordingOffer | MixingOffer;

interface BuyerIntentHubPageProps {
  hub: BuyerIntentHub;
  locale: Locale;
  relatedStories: StoryCardData[];
  relatedPortfolio: PortfolioItem[];
  primaryPackage: AnyPackage | null;
  secondaryPackage?: AnyPackage | null;
}

const SERVICE_LINK_PATH: Record<string, string> = {
  'wedding-song': '/wedding-song',
  'voice-acting': '/voice-acting',
  'lesson': '/lesson',
  'pricing': '/pricing',
  'practice-room': '/practice-room',
  'cover-video': '/cover-video',
  'release-project': '/release-project',
  'contact': '/contact',
};

const SERVICE_LINK_LABEL_KEY: Record<string, string> = {
  'wedding-song': 'nav.weddingSong',
  'voice-acting': 'nav.voiceActing',
  'lesson': 'nav.lesson',
  'pricing': 'nav.pricing',
  'practice-room': 'nav.practiceRoom',
  'cover-video': 'nav.coverVideo',
  'release-project': 'nav.releaseProject',
  'contact': 'nav.contact',
};

const BuyerIntentHubPage: React.FC<BuyerIntentHubPageProps> = ({
  hub,
  locale,
  relatedStories,
  relatedPortfolio,
  primaryPackage,
  secondaryPackage,
}) => {
  const { t } = useTranslation('common', { lng: locale });

  const storyCardLabels = React.useMemo(
    () => ({
      defaultCategory: t('stories.list.defaultCategory'),
      noDate: t('stories.list.noDate'),
      noTitle: t('stories.list.noTitle'),
      noContent: t('stories.list.noContent'),
      categoryByKey: Object.fromEntries(
        STORY_CATEGORY_KEYS.map((key) => [key, t(`stories.categories.${key}`)])
      ),
    }),
    [t]
  );

  const faqItems = React.useMemo(
    () => hub.quickAnswers.map((qa) => ({ question: qa.q, answer: qa.a })),
    [hub.quickAnswers]
  );

  const primaryServicePath = SERVICE_LINK_PATH[hub.primaryServiceLink] ?? '/contact';
  const secondaryServicePath = hub.secondaryServiceLink
    ? SERVICE_LINK_PATH[hub.secondaryServiceLink] ?? '/contact'
    : undefined;
  const primaryServiceLabel = t(SERVICE_LINK_LABEL_KEY[hub.primaryServiceLink] ?? 'nav.contact');
  const secondaryServiceLabel = hub.secondaryServiceLink
    ? t(SERVICE_LINK_LABEL_KEY[hub.secondaryServiceLink] ?? 'nav.contact')
    : undefined;

  return (
    <>
      <SEO
        locale={locale}
        title={hub.seoTitle}
        description={hub.seoDescription}
        keywords={hub.keywords}
        ogImage={hub.hero.image}
        ogImageAlt={hub.hero.imageAlt}
        canonical={`/${locale}/guides/${hub.slug}`}
        // Hub은 ko만 SSG된다 (getStaticPaths에서 한국어만 paths 반환). hreflang은
        // ko 단일 + x-default(ko)로 발행해 Google에 명시적으로 ko 단일 언어 페이지임을 알린다.
        availableLocales={['ko'] as const}
        includeSchema
        // 가이드 허브는 스튜디오 자체가 아니라 주제 콘텐츠 페이지 → 스토리·카테고리와
        // 동일하게 집계 리뷰 스키마 제외(self-serving review 정책 위반·수동 조치 리스크 방지).
        includeBusinessReviews={false}
        webPageType="WebPage"
        faqItems={faqItems}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: hub.seoTitle, path: `/${locale}/guides/${hub.slug}` },
        ]}
      />

      <ImageHero
        locale={locale}
        priority
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{hub.hero.title}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {hub.hero.titleHighlight}
            </span>
          </>
        }
        subtitle={hub.hero.subtitle}
        backgroundImage={hub.hero.image}
        imageAlt={hub.hero.imageAlt}
        minHeight="min-h-[80vh]"
        overlayGradient="from-black/55 via-black/30 to-black/45"
        ctaButtons={
          <>
            <Link
              href={`/${locale}${primaryServicePath}`}
              prefetch={false}
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation"
            >
              {primaryServiceLabel}
            </Link>
            {secondaryServicePath && (
              <Link
                href={`/${locale}${secondaryServicePath}`}
                prefetch={false}
                className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-primary border-2 border-primary text-white font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation"
              >
                {secondaryServiceLabel}
              </Link>
            )}
          </>
        }
      />

      {/* Intro paragraph */}
      <Section variant="default">
        <div className="max-w-3xl mx-auto">
          <p className="typo-section-lead text-gray-700 dark:text-gray-300 break-words [overflow-wrap:anywhere]">
            {hub.intro}
          </p>
        </div>
      </Section>

      {/* For whom */}
      <Section variant="alternate">
        <SectionHeading
          icon={Users}
          title="이런 분들에게 어울려요"
          subtitle="한 페이지에 모은 이유와 어떤 상황에 도움이 되는지"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {hub.forWhom.map((feature, idx) => (
            <div
              key={idx}
              className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="inline-flex items-center justify-center p-2.5 bg-primary/10 dark:bg-primary/20 rounded-full mb-4" aria-hidden="true">
                <CheckCircle2 className="text-primary dark:text-primary-light" size={20} />
              </div>
              <h3 className="typo-card-subtitle mb-2 text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="typo-card-body text-gray-600 dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Curated guides */}
      {relatedStories.length > 0 && (
        <Section variant="default">
          <SectionHeading
            icon={Sparkles}
            title="이 가이드들이 도와줍니다"
            subtitle="한 페이지에서 시작해 깊게 들어갈 수 있도록 단계별로 큐레이션했습니다."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedStories.map((story) => (
              <StoryCard
                key={story.slug}
                story={story}
                locale={locale}
                labels={storyCardLabels}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Pricing snapshot */}
      {primaryPackage && (
        <Section variant="alternate">
          <SectionHeading
            title="추천 패키지"
            subtitle="이 의도에 가장 맞는 패키지입니다. 상세는 가격 페이지에서 확인하세요."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <PricingCard
              id={primaryPackage.id}
              title={primaryPackage.title}
              price={primaryPackage.priceDisplay}
              unit={primaryPackage.unit}
              description={primaryPackage.description}
              features={[...primaryPackage.features]}
              recommended={'recommended' in primaryPackage ? primaryPackage.recommended : true}
              ctaLabel={t('nav.pricing')}
              ctaHref={`/${locale}/pricing`}
            />
            {secondaryPackage && (
              <PricingCard
                id={secondaryPackage.id}
                title={secondaryPackage.title}
                price={secondaryPackage.priceDisplay}
                unit={secondaryPackage.unit}
                description={secondaryPackage.description}
                features={[...secondaryPackage.features]}
                ctaLabel={t('nav.pricing')}
                ctaHref={`/${locale}/pricing`}
              />
            )}
          </div>
        </Section>
      )}

      {/* Related portfolio */}
      {relatedPortfolio.length > 0 && (
        <Section variant="default">
          <SectionHeading
            title="실제 작업 결과물"
            subtitle="가이드대로 진행한 실제 결과를 확인해보세요."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {relatedPortfolio.map((item) => (
              <PortfolioMiniCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={`/${locale}/portfolio`}
              prefetch={false}
              className="inline-flex items-center gap-1 typo-card-cta text-primary hover:underline"
            >
              {t('nav.portfolio')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Section>
      )}

      {/* FAQ — emits FAQPage schema via SEO faqItems */}
      <FAQSection
        items={faqItems}
        title="자주 묻는 질문"
        subtitle="이 페이지의 핵심 질문 5가지를 한곳에 모았습니다."
        variant="alternate"
      />

      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title="시작할 준비가 되셨나요"
          subtitle="카카오톡으로 가볍게 상담부터 시작할 수 있습니다."
          imageSrc={hub.hero.image}
          imageAlt={hub.hero.imageAlt}
          primaryButtonLabel={t('nav.contact')}
          secondaryButtonLabel={t('nav.pricing')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

export default BuyerIntentHubPage;
