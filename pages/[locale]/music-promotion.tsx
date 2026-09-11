import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import {
  Megaphone,
  Globe2,
  Newspaper,
  Mic,
  Video,
  ClipboardList,
  ShieldCheck,
  X,
  ArrowRight,
  CheckCircle2,
} from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import SectionHeading from '../../components/ui/SectionHeading';
import type { LucideIcon } from '@/lib/lucide-icons';
import BaseCard from '../../components/ui/BaseCard';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';
import { getRouteLastmod, formatLastmodDate } from '../../lib/pageLastmod';

// Below-fold 컴포넌트 code-splitting
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));

import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import {
  getPricingData,
  formatPriceLabel,
  RELEASE_PRESS_PRICE,
  RELEASE_PRESS_INTRO_PRICE,
  RELEASE_PRESS_INTRO_ENDS_ON,
} from '../../data/pricing';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createInViewEnterAnimation } from '../../utils/animationUtils';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import type { NextPageWithLayout } from '../../types';

const DELIVERABLE_ICONS: LucideIcon[] = [Newspaper, Globe2, Megaphone, Mic, Video, ClipboardList];

/** 실제로 만든 프레스킷. 페이지에서 "말 대신 결과물"을 보여주는 자리다. */
const CASE_LINKS = ['https://marikoyukie.vercel.app/ko/press', 'https://ggac.kr/ko/press/hwa'] as const;

// 컴포넌트 밖에서 한 번만 계산한다. 항목이 없으면 null(가짜 날짜 금지, lib/pageLastmod.ts).
const MUSIC_PROMOTION_LASTMOD_DISPLAY = formatLastmodDate(getRouteLastmod('/music-promotion'));

type MusicPromotionProps = {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  relatedStories: StoryCardData[];
};

/** '2026-12-31' → ko '2026년 12월 31일', 그 외 'December 31, 2026'. */
const formatEndsOn = (iso: string, locale: Locale): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (locale === 'ko') return `${y}년 ${m}월 ${d}일`;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const MusicPromotion: NextPageWithLayout<MusicPromotionProps> = ({
  locale,
  pricingData,
  relatedStories,
}) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  /**
   * 카피가 말하는 가격은 전부 data/pricing.ts에서 끌어온다.
   * 도입가가 끝나 정가로 돌아가는 날, 카피를 따로 고칠 일이 없어야 한다.
   */
  const priceVars = React.useMemo(
    () => ({
      intro: formatPriceLabel(RELEASE_PRESS_INTRO_PRICE, locale),
      list: formatPriceLabel(RELEASE_PRESS_PRICE, locale),
      until: formatEndsOn(RELEASE_PRESS_INTRO_ENDS_ON, locale),
    }),
    [locale]
  );

  // 가격을 말하는 답이 섞여 있어 보간을 넘겨 렌더한다.
  const quickAnswers = React.useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        question: t(`musicPromotion.quickAnswers.items.${i}.q`),
        answer: t(`musicPromotion.quickAnswers.items.${i}.a`, priceVars),
      })),
    [t, priceVars]
  );

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'musicPromotion.faq.items', 6),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'musicPromotion.process.steps', 6),
    [t]
  );

  const pressOffer = React.useMemo(
    () => pricingData.additionalServices.find((offer) => offer.id === 'service-release-press'),
    [pricingData]
  );

  const comparisonRows = React.useMemo(
    () =>
      (t('musicPromotion.comparison.rows', { returnObjects: true }) as string[][]).map((row) =>
        row.map((cell) => cell.replace('{{intro}}', priceVars.intro))
      ),
    [t, priceVars]
  );

  const comparisonColumns = t('musicPromotion.comparison.columns', { returnObjects: true }) as string[];
  const deliverables = t('musicPromotion.deliverables.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];
  const cases = t('musicPromotion.evidence.cases', { returnObjects: true }) as {
    title: string;
    meta: string;
    stats: string[];
    note: string;
  }[];
  const criteria = t('musicPromotion.review.criteria', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];
  const notPromised = t('musicPromotion.notPromised.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  const pageUrl = `${siteConfig.url}/${locale}/music-promotion`;
  const schema = React.useMemo(
    () =>
      buildSchemaGraph(
        buildStudioServiceSchema({
          locale,
          siteName: siteConfig.name,
          siteUrl: siteConfig.url,
          pageUrl,
          name: t('musicPromotion.hero.title'),
          description: t('musicPromotion.seo.description'),
          serviceType: locale === 'ko' ? '음원 발매 홍보' : 'Music Release Publicity',
          offerName: t('musicPromotion.hero.title'),
          offerPrice: RELEASE_PRESS_INTRO_PRICE,
          pricingHash: 'additional-services',
        }),
        generateHowToSchema(
          t('musicPromotion.process.title'),
          t('musicPromotion.process.subtitle'),
          howToSteps
        )
      ),
    [locale, siteConfig, pageUrl, t, howToSteps]
  );

  return (
    <>
      <SEO
        locale={locale}
        title={t('musicPromotion.seo.title')}
        description={t('musicPromotion.seo.description')}
        keywords={t('musicPromotion.seo.keywords')}
        includeSchema
        canonical={`/${locale}/music-promotion`}
        faqItems={faqItems}
        schema={schema}
      />

      <ImageHero
        locale={locale}
        priority
        backgroundImage="/images/console.webp"
        imageAlt={t('musicPromotion.hero.alt')}
        title={t('musicPromotion.hero.title')}
        subtitle={
          <span className="block space-y-2">
            <span className="block">{t('musicPromotion.hero.subtitleLine1')}</span>
            <span className="block">{t('musicPromotion.hero.subtitleLine2', priceVars)}</span>
            <span className="mt-4 inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">
              {t('musicPromotion.hero.badge', priceVars)}
            </span>
          </span>
        }
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="MusicPromotionHero"
            ctaId="music_promotion_hero_kakao"
            label={t('musicPromotion.cta.inquiry')}
            /* 비-ko는 목적지가 /contact 폼이라 카카오를 명시한 라벨을 쓸 수 없다. */
            contactLabel={t('actions.contact')}
            phone={siteConfig.contact.phone}
            phoneCtaId="music_promotion_hero_phone"
          />
        }
      />

      <QuickAnswers
        title={t('musicPromotion.quickAnswers.title')}
        subtitle={t('musicPromotion.quickAnswers.subtitle')}
        items={quickAnswers}
      />

      {/* 이 페이지의 핵심 논거 — 우리 가격이 비싼 게 아니라 다른 물건이라는 것 */}
      <Section>
        <SectionHeading
          title={t('musicPromotion.comparison.title')}
          subtitle={t('musicPromotion.comparison.subtitle')}
        />
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {comparisonColumns.map((col, i) => (
                  <th
                    key={col || `col-${i}`}
                    scope="col"
                    className={`px-4 py-3 font-semibold ${
                      i === comparisonColumns.length - 1
                        ? 'text-primary'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row[0]} className="border-b border-gray-100 dark:border-gray-800">
                  {row.map((cell, i) => (
                    <td
                      key={`${row[0]}-${i}`}
                      className={`px-4 py-3 ${
                        i === 0
                          ? 'font-medium text-gray-700 dark:text-gray-300'
                          : i === row.length - 1
                            ? 'font-semibold text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {t('musicPromotion.comparison.note')}
        </p>
      </Section>

      {/* 게재 실적 기록이 아직 얇으므로 실행량으로 증명한다 */}
      <Section className="bg-gray-50 dark:bg-gray-900/40">
        <SectionHeading
          title={t('musicPromotion.evidence.title')}
          subtitle={t('musicPromotion.evidence.subtitle')}
        />
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {cases.map((item, index) => (
            <m.div key={item.title} {...createInViewEnterAnimation({ delay: index * 0.1 })}>
              <BaseCard variant="glass" className="h-full p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.meta}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {item.stats.map((stat) => (
                    <li
                      key={stat}
                      className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                    >
                      {stat}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {item.note}
                </p>
                <a
                  href={CASE_LINKS[index] ?? CASE_LINKS[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  {t('musicPromotion.evidence.linkLabel')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </BaseCard>
            </m.div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          title={t('musicPromotion.deliverables.title')}
          subtitle={t('musicPromotion.deliverables.subtitle')}
        />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deliverables.map((item, index) => {
            const Icon = DELIVERABLE_ICONS[index] ?? Newspaper;
            return (
              <m.div key={item.title} {...createInViewEnterAnimation({ delay: index * 0.06 })}>
                <BaseCard className="h-full p-6">
                  <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 font-bold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {item.body}
                  </p>
                </BaseCard>
              </m.div>
            );
          })}
        </div>
      </Section>

      <Section className="bg-gray-50 dark:bg-gray-900/40">
        <SectionHeading
          title={t('musicPromotion.process.title')}
          subtitle={t('musicPromotion.process.subtitle')}
        />
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {howToSteps.map((step, index) => (
            <li key={step.name}>
              <BaseCard className="h-full p-6">
                <span className="text-sm font-bold text-primary">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 font-bold text-gray-900 dark:text-white">{step.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {step.text}
                </p>
              </BaseCard>
            </li>
          ))}
        </ol>
      </Section>

      {/* 심사 — 가격이 낮을수록 "싸서 대충 하는 게 아니다"를 말해야 한다 */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t('musicPromotion.review.title')} />
          <p className="mt-6 text-lg leading-relaxed text-gray-700 dark:text-gray-200">
            {t('musicPromotion.review.lead')}
          </p>
          <div className="mt-8 space-y-5">
            {criteria.map((item) => (
              <div key={item.title} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 rounded-xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
            {t('musicPromotion.review.rejection')}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {t('musicPromotion.review.why')}
          </p>
        </div>
      </Section>

      {/* 약속하지 않는 것을 먼저 말하는 것이 이 바닥에서는 신뢰 신호다 */}
      <Section className="bg-gray-50 dark:bg-gray-900/40">
        <SectionHeading
          title={t('musicPromotion.notPromised.title')}
          subtitle={t('musicPromotion.notPromised.subtitle')}
        />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {notPromised.map((item) => (
            <BaseCard key={item.title} className="h-full p-6">
              <X className="h-6 w-6 text-gray-400" aria-hidden="true" />
              <h3 className="mt-3 font-bold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {item.body}
              </p>
            </BaseCard>
          ))}
        </div>
        <div className="mx-auto mt-8 flex max-w-3xl gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
            {t('musicPromotion.notPromised.instead')}
          </p>
        </div>
      </Section>

      <Section id="pricing" className="scroll-mt-32">
        <SectionHeading
          title={t('musicPromotion.pricing.title')}
          subtitle={t('musicPromotion.pricing.subtitle')}
        />
        {pressOffer && (
          <div className="mx-auto mt-8 max-w-md">
            <PricingCard
              id={pressOffer.id}
              title={pressOffer.title}
              price={pressOffer.priceDisplay}
              description={pressOffer.description}
              features={deliverables.map((item) => item.title)}
              recommended
              ctaHref={siteConfig.contact.kakaoUrl}
              trackingComponent="MusicPromotionPricing"
            />
          </div>
        )}
        <div className="mx-auto mt-6 max-w-2xl space-y-3 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>{t('musicPromotion.pricing.note', priceVars)}</p>
          <p className="font-medium text-gray-600 dark:text-gray-300">
            {t('musicPromotion.pricing.capacity')}
          </p>
        </div>
      </Section>

      <FAQSection
        title={t('musicPromotion.faq.title')}
        subtitle={t('musicPromotion.faq.subtitle')}
        items={faqItems}
      />

      {MUSIC_PROMOTION_LASTMOD_DISPLAY && (
        <p className="pb-4 text-center text-xs text-gray-400 dark:text-gray-500">
          {MUSIC_PROMOTION_LASTMOD_DISPLAY}
        </p>
      )}

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('musicPromotion.relatedStoriesTitle')}
        subtitle={t('musicPromotion.relatedStoriesSubtitle')}
      />

      <Section className="pt-0">
        <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/release-project`}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-300"
          >
            {t('nav.releaseProject', '발매 프로젝트')}
          </Link>
          <Link
            href={`/${locale}/mixing-mastering`}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-300"
          >
            {t('nav.mixingMastering', '믹싱 · 마스터링')}
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-300"
          >
            {t('nav.pricing', '가격 안내')}
          </Link>
        </div>
      </Section>

      <ContactCTA
        locale={locale}
        icon={Megaphone}
        title={
          <>
            {t('musicPromotion.cta.titleLine1')}{' '}
            <span className="text-primary">{t('musicPromotion.cta.titleHighlight')}</span>
          </>
        }
        subtitle={
          <>
            {t('musicPromotion.cta.subtitleLine1')}
            <br />
            {t('musicPromotion.cta.subtitleLine2')}
          </>
        }
        imageSrc="/images/console.webp"
        imageAlt={t('musicPromotion.cta.imageAlt')}
      />
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => getCommonStaticPaths();

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const relatedStories = getServiceRelatedStories('music-promotion', locale);

  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories },
    { revalidate: 86400, i18nSections: ['musicPromotion', 'stories'] }
  );
};

export default MusicPromotion;
