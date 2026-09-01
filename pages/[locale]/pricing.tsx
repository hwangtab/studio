import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Mic, SlidersHorizontal, Disc, Info, Star, PlusCircle, ArrowRight, MessageCircle, Building } from '@/lib/lucide-icons';
import { trackLeadEvent } from '../../utils/analytics';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import SectionHeading from '../../components/ui/SectionHeading';
import {
  formatPriceLabel,
  getPricingData,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL3_PRICE,
  PRACTICE_ROOM_MONTHLY_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';
import { getHubLocaleContent } from '../../data/faq';
import { Section } from '../../components/ui/Section';
import SectionAnchorNav from '../../components/ui/SectionAnchorNav';
import PricingCard from '../../components/ui/PricingCard';
import HubLocaleContentSection from '../../components/ui/HubLocaleContentSection';
import ImageHero from '../../components/common/ImageHero';

// Below-fold 컴포넌트 code-splitting (초기 JS 번들 감소 → TBT 단축)
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));
const HubLinkCallout = dynamic(() => import('../../components/guides/HubLinkCallout'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import { buildPricingPageSchema } from '../../lib/pricingSchema';
import type { StoryCardData } from '../../types/story';
import type { NextPageWithLayout } from '../../types';

interface PricingProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  hubLocaleContent: ReturnType<typeof getHubLocaleContent>;
  relatedStories: StoryCardData[];
}

const Pricing: NextPageWithLayout<PricingProps> = ({ locale, pricingData, hubLocaleContent, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const {
    VAT_NOTICE,
    recordingOffers,
    mixingOffers,
    masteringOffers,
    additionalServices,
    specialPackages,
    practiceRoomOffers
  } = pricingData;

  const siteConfig = getSiteConfig(locale);
  const siteUrl = siteConfig.url;
  const kakaoUrl = siteConfig.contact.kakaoUrl;

  // 카피는 번역 파일에, 숫자는 data/pricing.ts SSOT에 남긴다(리터럴 하드코딩 금지).
  const priceLabels = React.useMemo(() => ({
    recordingHourly: formatPriceLabel(RECORDING_HOURLY_PRICE, locale),
    vocalPackage: formatPriceLabel(VOCAL_PACKAGE_PRICE, locale),
    practiceRoom: formatPriceLabel(PRACTICE_ROOM_MONTHLY_PRICE, locale),
    wedding: formatPriceLabel(WEDDING_PACKAGE_PRICE, locale),
    mixingFrom: formatPriceLabel(MIXING_LEVEL1_PRICE, locale),
    mixingTo: formatPriceLabel(MIXING_LEVEL3_PRICE, locale),
    masteringSingle: formatPriceLabel(MASTERING_SINGLE_PRICE, locale),
  }), [locale]);

  // 이 배열은 화면의 QuickAnswers 섹션이자 SEO faqItems(=FAQPage JSON-LD)의 원본이다.
  // 예전 답변은 "아래 가격표에서 확인할 수 있습니다" 같은 안내문이라 그대로 스키마에
  // 실려 나갔고, LLM이 통째로 인용해도 답이 안 나왔다. 답변마다 실제 수치를 넣는다.
  const pricingQuickAnswers = React.useMemo(() => ([
    {
      question: t('pricing.quickAnswers.items.0.q'),
      answer: t('pricing.quickAnswers.items.0.a', {
        vatNotice: VAT_NOTICE,
        vocalPackage: priceLabels.vocalPackage,
        recordingHourly: priceLabels.recordingHourly,
      }),
    },
    {
      question: t('pricing.quickAnswers.items.1.q'),
      answer: t('pricing.quickAnswers.items.1.a', {
        mixingNotice: t('pricing.mixing.noticeBody'),
        mixingFrom: priceLabels.mixingFrom,
        mixingTo: priceLabels.mixingTo,
        masteringSingle: priceLabels.masteringSingle,
      }),
    },
    {
      question: t('pricing.quickAnswers.items.2.q'),
      answer: t('pricing.quickAnswers.items.2.a', { practiceRoom: priceLabels.practiceRoom }),
    },
    {
      question: t('pricing.quickAnswers.items.3.q'),
      answer: t('pricing.quickAnswers.items.3.a', { phone: siteConfig.contact.phone }),
    },
  ]), [t, VAT_NOTICE, priceLabels, siteConfig.contact.phone]);

  // 상단 즉답 가격 요약표 — 전부 가격 SSOT(pricingData)에서 끌어온다(하드코딩 0).
  // AI 검색(ChatGPT 등)·외부 유입이 above-the-fold에서 전체 단가를 즉시 스캔하도록 —
  // 상세 카드는 아래 섹션에 그대로 있고, 이 표는 이탈 방지·AI 인용용 압축 뷰다.
  // 카테고리 그룹 헤더 + 오퍼별 부제(subtitle)를 넣어 상품명만으로 뭘 사는지
  // 알 수 있게 한다.
  const summaryGroups = React.useMemo(
    () => [
      { id: 'special', title: t('pricing.special.title'), offers: specialPackages },
      { id: 'recording', title: t('pricing.recording.title'), offers: recordingOffers },
      { id: 'mixing', title: t('pricing.mixing.title'), offers: mixingOffers },
      { id: 'mastering', title: t('pricing.mastering.title'), offers: masteringOffers },
      { id: 'practice-room', title: t('pricing.practiceRoom.title'), offers: practiceRoomOffers },
    ],
    [t, specialPackages, recordingOffers, mixingOffers, masteringOffers, practiceRoomOffers]
  );

  // 긴 가격 페이지(특수패키지→녹음→믹싱→마스터링→부가서비스)를 바로 점프하는 앵커 목차.
  const anchorItems = React.useMemo(() => [
    { id: 'special-packages', label: t('pricing.special.title') },
    { id: 'recording', label: t('pricing.recording.title') },
    { id: 'mixing', label: t('pricing.mixing.title') },
    { id: 'mastering', label: t('pricing.mastering.title') },
    { id: 'practice-room', label: t('pricing.practiceRoom.title') },
    { id: 'support-services', label: t('pricing.additional.title') },
  ], [t]);

  const pricingSchema = React.useMemo(
    () => buildPricingPageSchema({
      locale,
      siteUrl,
      pricingData,
      t,
    }),
    [locale, pricingData, siteUrl, t]
  );

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t('pricing.seo.title')}
        description={t('pricing.seo.description')}
        keywords={t('pricing.seo.keywords')}
        ogImage="/images/og-hardware2.webp"
        ogImageAlt={t('pricing.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        webPageType="WebPage"
        canonical={`/${locale}/pricing`}
        faqItems={pricingQuickAnswers}
        schema={pricingSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.pricing'), path: `/${locale}/pricing` },
        ]}
      />

      {/* Hero Section */}
      <ImageHero
        locale={locale}
        priority
        // H1에 실단가를 넣는다. 이전 H1은 "합리적인 가격, 투명한 서비스"로 숫자가 하나도
        // 없었는데 <title>은 "연습실 월 36만원·녹음 10만원…"을 약속했다. 가격을 확인하러
        // 온 유입(ChatGPT 경유 이탈 85.7%·체류 13초)이 첫 화면에서 숫자를 못 보고 즉시
        // 되돌아가던 구조 — 약속과 도착지를 일치시킨다.
        //
        // 여기만 i18n 보간이 아니라 common.json 리터럴을 쓴다. hero h1은 LCP 요소이고
        // scripts/generate-hero-font.mjs가 i18n '템플릿 문자열'을 스캔해 woff2 subset을
        // 만들기 때문에, {{보간}}을 쓰면 실제 렌더링되는 숫자 글자가 subset에서 빠져
        // 폴백 폰트로 떨어진다. 상수와의 정합은 data/pricing.test.ts가 강제한다
        // (releaseProject.tiers.*.range와 동일한 기존 패턴).
        title={t('pricing.hero.title')}
        subtitle={
          <>
            <span className="block">{t('pricing.hero.subtitleLine1')}</span>
            <span className="block">{t('pricing.hero.subtitleLine2')}</span>
          </>
        }
        backgroundImage="/images/hardware2.webp"
        imageAlt={t('pricing.hero.alt')}
        // 60vh → 40vh: 아래 요약표를 모바일 첫 화면 안으로 끌어올린다.
        minHeight="min-h-[40vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.pricing'), path: `/${locale}/pricing` },
        ]}
        ctaButtons={
          // AI 검색(ChatGPT 등)·외부 유입이 가격 페이지에 바로 착지하는 비중이 큰데
          // 기존엔 above-the-fold 행동 버튼이 없어 이탈이 높았음. 검증된 전환 채널인
          // 카카오톡 직링크를 히어로에 노출해 즉시 견적 문의로 연결.
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'PricingHero',
                cta_id: 'pricing_hero_kakao',
              })
            }
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-kakao text-kakao-ink font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-kakao-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            {t('pricing.hero.ctaKakao', { defaultValue: '카톡으로 무료 견적 받기' })}
          </a>
        }
      />


      {/* 상단 즉답 가격 요약표 — 상세 카드로 스크롤하기 전에 전체 단가를 한눈에. */}
      <Section variant="default" className="py-10">
        <SectionHeading
          icon={Info}
          title={t('pricing.summary.title', { defaultValue: '한눈에 보는 가격표' })}
          className="mb-6"
        />
        <div className="max-w-3xl mx-auto overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">{t('pricing.summary.title', { defaultValue: '한눈에 보는 가격표' })}</caption>
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th scope="col" className="py-3 pr-4 typo-card-subtitle">
                  {t('pricing.summary.serviceCol', { defaultValue: '서비스' })}
                </th>
                <th scope="col" className="py-3 pl-4 text-right typo-card-subtitle">
                  {t('pricing.summary.priceCol', { defaultValue: '가격' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {summaryGroups.map((group, groupIndex) => (
                <React.Fragment key={group.id}>
                  <tr>
                    {/* 그룹 헤더는 항목(16px·500)보다 확실히 위여야 스크롤 중 위치를 잃지 않는다.
                        uppercase·tracking-wide는 한글에 각각 무효·역효과라 쓰지 않는다.
                        그룹 경계선은 직전 그룹 마지막 행의 border-b가 이미 그으므로
                        여백(pt-10)만 준다 — border-t를 더하면 선이 겹쳐 두 줄로 보인다. */}
                    <th
                      scope="rowgroup"
                      colSpan={2}
                      className={`typo-card-title pb-3 text-gray-900 dark:text-white ${
                        groupIndex === 0 ? 'pt-5' : 'pt-10'
                      }`}
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.offers.map((offer) => (
                    <tr key={offer.id} className="border-b border-gray-100 dark:border-gray-800">
                      <th scope="row" className="py-3 pr-4 font-normal align-top">
                        <div className="typo-card-body font-medium text-gray-900 dark:text-gray-100">{offer.title}</div>
                        {offer.subtitle && (
                          <div className="typo-card-meta text-gray-500 dark:text-gray-400 mt-0.5">{offer.subtitle}</div>
                        )}
                      </th>
                      <td className="py-3 pl-4 text-right whitespace-nowrap align-top">
                        <span className="font-bold text-primary dark:text-primary-light">{offer.priceDisplay}</span>{' '}
                        <span className="typo-card-meta">{offer.unit}</span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <p className="mt-4 typo-card-meta text-center">{VAT_NOTICE}</p>
        </div>
      </Section>

      <SectionAnchorNav
        items={anchorItems}
        ariaLabel={t('pricing.anchorNavLabel', { defaultValue: '가격 섹션 바로가기' })}
      />

      <QuickAnswers
        title={t('pricing.quickAnswers.title')}
        subtitle={t('pricing.quickAnswers.subtitle')}
        items={pricingQuickAnswers}
        variant="default"
      />

      <HubLocaleContentSection content={hubLocaleContent} icon={Info} />

      {/* Special Packages Section */}
      <Section id="special-packages" variant="alternate" className="scroll-mt-32">
        <SectionHeading
          icon={Star}
          title={t('pricing.special.title')}
          subtitle={t('pricing.special.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto" role="list">
          {specialPackages.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
                id={offer.id}
                title={offer.title}
                price={offer.priceDisplay}
                unit={offer.unit}
                description={offer.description}
                features={offer.features}
                recommended={offer.recommended}
                delay={0.1 * (index + 1)}
                ctaLabel={t('pricing.cta.inquiry')}
                ctaHref={kakaoUrl}
                trackingComponent="PricingSpecial"
                locale={locale}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Recording Section */}
      <Section id="recording" variant="default" className="scroll-mt-32">
        <SectionHeading
          icon={Mic}
          title={t('pricing.recording.title')}
          subtitle={t('pricing.recording.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto" role="list">
          {recordingOffers.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
                id={offer.id}
                title={offer.title}
                price={offer.priceDisplay}
                unit={offer.unit}
                description={offer.description}
                features={offer.features}
                recommended={offer.recommended}
                delay={0.1 * (index + 1)}
                ctaLabel={t('pricing.cta.inquiry')}
                ctaHref={kakaoUrl}
                trackingComponent="PricingRecording"
                locale={locale}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Mixing Section */}
      <Section id="mixing" variant="alternate" className="scroll-mt-32">
        <SectionHeading
          icon={SlidersHorizontal}
          title={t('pricing.mixing.title')}
          subtitle={t('pricing.mixing.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8" role="list">
          {mixingOffers.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
                id={offer.id}
                title={offer.title}
                price={offer.priceDisplay}
                unit={offer.unit}
                description={offer.description}
                features={offer.features}
                recommended={offer.recommended}
                delay={0.1 * (index + 1)}
                ctaLabel={t('pricing.cta.inquiry')}
                ctaHref={kakaoUrl}
                trackingComponent="PricingMixing"
                locale={locale}
              />
            </div>
          ))}
        </div>
        <div className="mt-8 max-w-3xl mx-auto glass-card rounded-xl p-6 ring-1 ring-primary/20 flex items-start">
          <Info className="text-primary mt-1 mr-3 flex-shrink-0" size={18} aria-hidden="true" />
          <div>
            <h3 className="typo-card-subtitle mb-1">{t('pricing.mixing.noticeTitle')}</h3>
            <p className="typo-card-body text-sm">
              {t('pricing.mixing.noticeBody')}
            </p>
          </div>
        </div>
      </Section>

      {/* Mastering Section */}
      <Section id="mastering" variant="default" className="scroll-mt-32">
        <SectionHeading
          icon={Disc}
          title={t('pricing.mastering.title')}
          subtitle={t('pricing.mastering.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto" role="list">
          {masteringOffers.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
                id={offer.id}
                title={offer.title}
                price={offer.priceDisplay}
                unit={offer.unit}
                description={offer.description}
                features={offer.features}
                recommended={offer.recommended}
                delay={0.1 * (index + 1)}
                ctaLabel={t('pricing.cta.inquiry')}
                ctaHref={kakaoUrl}
                trackingComponent="PricingMastering"
                locale={locale}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* 음악연습실 입주 — <title>·h1이 선두로 약속한 단가의 도착지.
          시설·혜택 정본은 /practice-room이고 여기서는 계약 조건만 다룬 뒤 넘긴다. */}
      <Section id="practice-room" variant="alternate" className="scroll-mt-32">
        <SectionHeading
          icon={Building}
          title={t('pricing.practiceRoom.title')}
          subtitle={t('pricing.practiceRoom.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="max-w-md mx-auto" role="list">
          {practiceRoomOffers.map((offer) => (
            <div key={offer.id} role="listitem">
              <PricingCard
                id={offer.id}
                title={offer.title}
                price={offer.priceDisplay}
                unit={offer.unit}
                description={offer.description}
                features={offer.features}
                delay={0.1}
                ctaLabel={t('pricing.cta.inquiry')}
                ctaHref={kakaoUrl}
                trackingComponent="PricingPracticeRoom"
                locale={locale}
              />
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 typo-card-body font-semibold text-primary hover:underline"
          >
            {t('pricing.practiceRoom.detailLink')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* Additional Services Section */}
      <Section id="support-services" variant="default" className="scroll-mt-32">
        <SectionHeading
          icon={PlusCircle}
          title={t('pricing.additional.title')}
          subtitle={t('pricing.additional.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="list">
          {additionalServices.map((service, index) => (
            <div key={service.id} role="listitem">
              <PricingCard
                id={service.id}
                title={service.title}
                price={service.priceDisplay}
                unit={service.unit}
                description={service.description}
                features={service.note ? [service.note] : []}
                delay={0.1 * (index + 1)}
                ctaLabel={t('pricing.cta.inquiry')}
                ctaHref={kakaoUrl}
                trackingComponent="PricingAdditional"
                locale={locale}
              />
            </div>
          ))}
        </div>
      </Section>

      <ReviewSection variant="alternate" locale={locale} />

      <HubLinkCallout
        hubSlug="home-recording-survival"
        locale={locale}
        title={t('pricing.hubCallout.title', { defaultValue: '원룸·자취방에서 데모 만들기 — 종합 가이드' })}
        subtitle={t('pricing.hubCallout.subtitle', { defaultValue: '홈레코딩 한계와 스튜디오 전환 시점까지 한 페이지에 정리한 생존 가이드.' })}
      />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('pricing.relatedStoriesTitle', { defaultValue: '예약 전 한 번 더 살펴보면 좋은 가이드' })}
        subtitle={t('pricing.relatedStoriesSubtitle', { defaultValue: '비용·발매·녹음 절차를 미리 알면 첫 세션을 더 알차게 쓸 수 있습니다.' })}
      />

      {/* 관련 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          {/* 발매 프로젝트를 맨 앞에 — 통합 패키지가 기획·유통·홍보까지 포함하므로
              그 다음 행선지이고, 바로 아래 CTA가 부르는 페이지이기도 하다.
              라벨에 nav.releaseProject를 쓰지 않는다: ko만 '음원 발매 개요'이고
              나머지 로케일은 드롭다운 하위 라벨인 'Overview'라 단독으로 뜻이 안 통한다. */}
          <Link
            href={`/${locale}/release-project`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('pricing.releaseLink')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/studio-info`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* Improved CTA Section */}
      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={t('pricing.cta.title')}
          subtitle={t('pricing.cta.subtitle')}
          imageSrc="/images/recording15.webp"
          imageAlt={t('pricing.images.packageAlt')}
          primaryButtonLabel={t('pricing.cta.inquiry')}
          secondaryButtonLabel={t('pricing.cta.location')}
          headingAs="h3"
        />
      </Section>
    </div>
  );
};

Pricing.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const hubLocaleContent = getHubLocaleContent(locale, 'pricing');
  const relatedStories = getServiceRelatedStories('pricing', locale);
  return buildPageStaticProps(
    locale,
    {
      pricingData,
      hubLocaleContent,
      relatedStories,
    },
    { revalidate: 86400, i18nSections: ['pricing', 'stories'] }
  );
};

export default Pricing;
