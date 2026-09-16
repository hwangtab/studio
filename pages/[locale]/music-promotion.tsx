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

/**
 * 실제로 만든 프레스킷. 페이지에서 "말 대신 결과물"을 보여주는 자리다.
 *
 * 카피의 cases 배열과 순서가 맞아야 한다. 사례를 늘릴 때 여기를 빠뜨리면
 * 새 사례가 남의 프레스킷을 가리키게 되므로, 링크가 없으면 아예 안 그린다.
 */
/** 실제로 만들어 운영 중인 프레스킷 페이지. 경쟁사가 못 보여주는 실물 증거라
 *  "포함되는 것"의 프레스킷 항목에서 바로 열 수 있게 둔다. */
/** deliverables.items에서 프레스킷 페이지 항목의 자리(0-based). 순서가 바뀌면 함께 옮길 것. */
const PRESS_KIT_ITEM_INDEX = 1;

const PRESS_KIT_SAMPLES: readonly { href: string; key: string }[] = [
  { href: 'https://marikoyukie.vercel.app/ko/press', key: 'namsanTower' },
  { href: 'https://ggac.kr/ko/press/hwa', key: 'hwa' },
];

// 컴포넌트 밖에서 한 번만 계산한다. 항목이 없으면 null(가짜 날짜 금지, lib/pageLastmod.ts).
const MUSIC_PROMOTION_LASTMOD_DISPLAY = formatLastmodDate(getRouteLastmod('/music-promotion'));

type MusicPromotionProps = {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  relatedStories: StoryCardData[];
};

/**
 * '2026-12-31'을 각 로케일 표기로.
 *
 * 이 날짜는 할인 종료일이라 카피 안에 들어간다. en-US로 고정하면 태국어 문장
 * 한가운데 "December 31, 2026"이 끼어든다.
 */
const DATE_LOCALE: Record<Locale, string> = {
  ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', es: 'es-ES', vi: 'vi-VN', th: 'th-TH', uz: 'uz-UZ',
};

const formatEndsOn = (iso: string, locale: Locale): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(DATE_LOCALE[locale] ?? 'en-US', {
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

  const outcomes = t('musicPromotion.outcome.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  // 가격을 말하는 답이 섞여 있어 보간을 넘겨 렌더한다.
  // 개수는 3열 그리드에 맞춰 6이다 — 4면 마지막 줄에 한 장만 남는다.
  // 이 숫자와 ko 배열 길이의 일치는 utils/translatedList.counts.test.ts가 지킨다.
  const quickAnswers = React.useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        question: t(`musicPromotion.quickAnswers.items.${i}.q`),
        answer: t(`musicPromotion.quickAnswers.items.${i}.a`, priceVars),
      })),
    [t, priceVars]
  );

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'musicPromotion.faq.items', 9),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'musicPromotion.process.steps', 7),
    [t]
  );

  const pressOffer = React.useMemo(
    () => pricingData.additionalServices.find((offer) => offer.id === 'service-release-press'),
    [pricingData]
  );

  const comparisonRows = React.useMemo(
    () =>
      (t('musicPromotion.comparison.rows', { returnObjects: true }) as string[][]).map((row) =>
        // 셀에 어떤 가격 변수가 올지 모르므로 전부 치환한다. {{intro}}만 치환하던 동안
        // 번들 열의 "{{list}} 상당"이 화면에 그대로 찍히고 있었다.
        row.map((cell) =>
          Object.entries(priceVars).reduce((acc, [key, value]) => acc.split(`{{${key}}}`).join(value), cell)
        )
      ),
    [t, priceVars]
  );

  const comparisonColumns = t('musicPromotion.comparison.columns', { returnObjects: true }) as string[];
  const deliverables = t('musicPromotion.deliverables.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];
  const criteria = t('musicPromotion.review.criteria', { returnObjects: true }) as {
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
          pricingHash: 'support-services',
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
        /* 히어로와 같은 사진이어야 한다 — 히어로를 믹싱 콘솔에서 서울 야경으로 바꿀 때
           OG를 안 따라 바꿔, 공유 썸네일에는 콘솔이 나가는데 og:image:alt는 "밤의 서울
           도심 전경"을 말하고 있었다. 카카오톡은 og:image를 URL 단위로 캐시하므로
           그림만 갈아 끼우지 말고 파일명을 바꿀 것(커밋 85178f14ad). */
        ogImage="/images/og-music-promotion.webp"
        ogImageAlt={t('musicPromotion.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/music-promotion`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('musicPromotion.hero.title'), path: `/${locale}/music-promotion` },
        ]}
        faqItems={faqItems}
        schema={schema}
      />

      <ImageHero
        locale={locale}
        priority
        /**
         * 밤의 서울 전경.
         *
         * 전에는 console.webp였는데 두 가지가 틀렸다. 960×1280 **세로** 사진을 가로
         * 히어로에 늘려 쓰고 있었고, 무엇보다 믹싱 콘솔은 "녹음 스튜디오"를 말하지
         * 이 페이지가 파는 "발매를 알리는 일"을 말하지 않는다.
         *
         * 이 사진은 1280×720이고 위쪽 절반이 거의 검은 하늘이라 흰 제목이 가장 잘
         * 산다 — 히어로 텍스트 대비를 실측해서 고른 자리다. 얼굴이 없어 초상 사용
         * 문제도 없다.
         */
        backgroundImage="/images/seoul-night-skyline.webp"
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

      {/* 이 페이지의 가장 큰 구멍을 메우는 섹션. 이 자리에 오기 전까지 페이지는
          "저희는 ~합니다"만 139문장 중 137문장이었고, 아티스트에게 무엇이 생기는지를
          말하는 문장이 둘뿐이었다. 게재를 약속하지 않고도 100% 이행할 수 있는 것만 적는다. */}
      <Section>
        <SectionHeading
          title={t('musicPromotion.outcome.title')}
          subtitle={t('musicPromotion.outcome.subtitle')}
        />
        {/* 테두리 없이 여백으로 나눈다. 이 페이지는 3열 네모 카드가 섹션마다
            반복돼 스크롤이 단조로웠다 — 형태는 내용의 성격을 따라가야 한다.
            여기 여섯 항목은 순서가 없는 병렬이고 본문이 길어, 칸을 좁히는 카드보다
            넓은 2열에 큰 번호를 세우는 쪽이 읽기 편하다. */}
        <div className="mx-auto mt-12 grid max-w-5xl gap-x-12 gap-y-10 sm:grid-cols-2">
          {outcomes.map((item, index) => (
            <m.div
              key={item.title}
              {...createInViewEnterAnimation({ delay: index * 0.05 })}
              className="flex gap-4"
            >
              <span className="shrink-0 text-3xl font-bold leading-none tabular-nums text-primary/25 dark:text-primary-lighter/25">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {item.body}
                </p>
              </div>
            </m.div>
          ))}
        </div>
      </Section>

      <QuickAnswers
        title={t('musicPromotion.quickAnswers.title')}
        subtitle={t('musicPromotion.quickAnswers.subtitle')}
        items={quickAnswers}
      />

      <Section>
        <SectionHeading
          title={t('musicPromotion.comparison.title')}
          subtitle={t('musicPromotion.comparison.subtitle')}
        />
        {/*
          모바일은 표가 아니라 카드다.

          전에는 min-w-[640px] 표를 가로 스크롤로 뒀는데, 390px 화면에서는 경쟁사
          두 열만 보이고 **우리 열이 잘려 나갔다**. 우리를 돋보이게 하려는 표가
          정확히 우리만 숨기고 있었다. 항목마다 세 답을 세로로 쌓으면 잘릴 것이 없다.
        */}
        <div className="mt-8 space-y-4 md:hidden">
          {comparisonRows.map((row) => (
            <div
              key={`card-${row[0]}`}
              className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {row[0]}
              </p>
              <dl className="mt-3 space-y-2">
                {row.slice(1).map((cell, i) => {
                  const isUs = i === row.length - 2;
                  return (
                    <div
                      key={`card-${row[0]}-${i}`}
                      className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 ${
                        isUs ? 'bg-primary/10 dark:bg-primary/20' : ''
                      }`}
                    >
                      <dt
                        className={`text-xs ${
                          isUs
                            ? 'font-semibold text-primary dark:text-primary-lighter'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {comparisonColumns[i + 1]}
                      </dt>
                      <dd
                        className={`text-sm ${
                          isUs
                            ? 'font-semibold text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {cell}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {comparisonColumns.map((col, i) => {
                  const isUs = i === comparisonColumns.length - 1;
                  return (
                    <th
                      key={col || `col-${i}`}
                      scope="col"
                      className={`px-4 py-3 font-semibold ${
                        isUs
                          ? 'rounded-t-xl bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-lighter'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {/* 첫 칸은 행 이름이라 제목이 없다. 비어 보이지 않게 스크린리더용으로만 둔다. */}
                      {i === 0 ? <span className="sr-only">{t('musicPromotion.comparison.rowHeader')}</span> : col}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row[0]} className="border-b border-gray-100 dark:border-gray-800">
                  {row.map((cell, i) => {
                    const isUs = i === row.length - 1;
                    return (
                      <th
                        key={`${row[0]}-${i}`}
                        scope={i === 0 ? 'row' : undefined}
                        // 첫 칸만 행 제목(th), 나머지는 데이터 칸이다.
                        {...(i === 0 ? {} : { role: 'cell' })}
                        className={`px-4 py-3 text-left ${
                          i === 0
                            ? 'font-medium text-gray-700 dark:text-gray-300'
                            : isUs
                              ? 'bg-primary/10 font-semibold text-gray-900 dark:bg-primary/20 dark:text-white'
                              : 'font-normal text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {cell}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {t('musicPromotion.comparison.note')}
        </p>
      </Section>

      <Section>
        <SectionHeading
          title={t('musicPromotion.deliverables.title')}
          subtitle={t('musicPromotion.deliverables.subtitle', priceVars)}
        />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deliverables.map((item, index) => {
            const Icon = DELIVERABLE_ICONS[index] ?? Newspaper;
            return (
              <m.div key={item.title} {...createInViewEnterAnimation({ delay: index * 0.06 })}>
                <BaseCard className="h-full p-6">
                  <Icon className="h-7 w-7 text-primary dark:text-primary-lighter" aria-hidden="true" />
                  <h3 className="mt-4 font-bold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {item.body}
                  </p>
                  {/* 프레스킷 항목에서만 실물을 연다. 말로 설명하는 것보다
                      실제로 운영 중인 페이지를 여는 쪽이 강하고, 경쟁사는 못 하는 일이다. */}
                  {index === PRESS_KIT_ITEM_INDEX && (
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                      {PRESS_KIT_SAMPLES.map((sample) => (
                        <a
                          key={sample.href}
                          href={sample.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline"
                        >
                          {t(`musicPromotion.deliverables.samples.${sample.key}`)}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
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
        {/* 단계는 순서가 있는 흐름이라 그리드에 흩어 놓으면 흐름이 안 보인다 —
            번호를 붙여도 왼→오른→다음 줄로 읽히는 힘은 약하다. 세로 타임라인은
            순서를 형태로 말한다.

            페이지 리듬도 같이 본다. 이 페이지는 3열 카드가 다섯 섹션 연속이라
            스크롤이 단조로웠다. 타임라인·카드·표 세 형태가 섞여야 읽는 눈이 쉰다.

            왼쪽 정렬이지만 축이 둘로 갈리지 않는다 — 번호 마커가 일렬로 서서
            그 자체로 시각적 중심을 만든다(review 섹션에서 겪은 문제와 다른 경우). */}
        <ol className="relative mx-auto mt-10 max-w-3xl">
          {howToSteps.map((step, index) => (
            <li key={step.name} className="relative flex gap-5 pb-10 last:pb-0">
              {index < howToSteps.length - 1 && (
                <span
                  className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-px bg-gradient-to-b from-primary/40 to-primary/10 dark:from-primary-lighter/40 dark:to-primary-lighter/10"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-sm font-bold tabular-nums text-primary dark:border-primary-lighter/25 dark:bg-primary-lighter/10 dark:text-primary-lighter">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="pt-1.5">
                <h3 className="font-bold text-gray-900 dark:text-white">{step.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        {/* 이 섹션만 단일 컬럼이라 제목은 가운데, 본문은 왼쪽으로 축이 둘이었다.
            나머지 섹션(outcome·deliverables·process)과 같은 3열 카드로 맞춘다. */}
        <SectionHeading
          title={t('musicPromotion.review.title')}
          subtitle={t('musicPromotion.review.lead')}
        />
        {/* 세 항목뿐이라 카드 3열은 과했다. 체크 아이콘이 일렬로 서면서
            타임라인의 번호 마커와 같은 원리로 시각적 중심을 만든다 —
            제목이 가운데여도 축이 갈리지 않는다(#127에서 고쳤던 경우와 다르다). */}
        <div className="mx-auto mt-10 max-w-3xl space-y-7">
          {criteria.map((item, index) => (
            <m.div
              key={item.title}
              {...createInViewEnterAnimation({ delay: index * 0.06 })}
              className="flex gap-4"
            >
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-primary-lighter"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {item.body}
                </p>
              </div>
            </m.div>
          ))}
        </div>
        {/* 이 페이지 전체가 한 사람의 판단에 걸려 있는데 그 사람이 끝까지 익명이었다.
            수상 이력은 쓰지 않고(운영자 톤) 이름과 소개 경로만 연다. */}
        <p className="mx-auto mt-6 max-w-3xl text-center">
          <Link
            href={`/${locale}/author`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline dark:text-primary-lighter"
          >
            {t('musicPromotion.review.producerLink')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
        <div className="mx-auto mt-8 max-w-3xl space-y-4 text-center">
          <p className="rounded-xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
            {t('musicPromotion.review.rejection')}
          </p>
          <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {t('musicPromotion.review.why')}
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
              locale={locale}
              /* ctaLabel이 없으면 PricingCard가 버튼을 통째로 그리지 않는다. */
              ctaLabel={t('musicPromotion.cta.inquiry')}
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
        {/* 결제 조건과 약관 링크는 값을 보는 자리에 붙어 있어야 한다.
            제작 착수 후 청약철회 제한은 "미리 고지"해야 효력이 생기므로
            (전자상거래법 제17조 제6항), 이 링크가 그 고지의 성립 조건이다.
            떼면 환불 규정이 약관에 적혀 있어도 무효가 된다. */}
        <div className="mx-auto mt-8 flex max-w-2xl gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-primary-lighter" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
            {t('musicPromotion.payment.assurance')}
            {locale === 'ko' && (
              <>
                {' '}
                <Link
                  href="/ko/terms"
                  className="underline underline-offset-2 transition hover:text-primary dark:hover:text-primary-lighter"
                >
                  {t('musicPromotion.payment.termsLink')}
                </Link>
              </>
            )}
          </p>
        </div>
      </Section>

      <FAQSection
        title={t('musicPromotion.faq.title')}
        subtitle={t('musicPromotion.faq.subtitle')}
        items={faqItems}
      />

      {MUSIC_PROMOTION_LASTMOD_DISPLAY && (
        <p className="pb-4 text-center text-xs text-gray-500 dark:text-gray-400">
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
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:border-primary hover:text-primary dark:hover:text-primary-lighter dark:border-gray-600 dark:text-gray-300"
          >
            {t('nav.releaseProject', '발매 프로젝트')}
          </Link>
          <Link
            href={`/${locale}/mixing-mastering`}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:border-primary hover:text-primary dark:hover:text-primary-lighter dark:border-gray-600 dark:text-gray-300"
          >
            {t('nav.mixingMastering', '믹싱 · 마스터링')}
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:border-primary hover:text-primary dark:hover:text-primary-lighter dark:border-gray-600 dark:text-gray-300"
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
            <span className="text-primary dark:text-primary-lighter">{t('musicPromotion.cta.titleHighlight')}</span>
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

/**
 * 히어로가 있는 페이지는 헤더를 투명하게 띄워 사진 위에 얹는다(_app.tsx가
 * Component.hasHero를 읽어 Layout에 넘긴다). 이 줄이 없으면 헤더가 불투명하게
 * 남고 본문이 pt-20만큼 밀려, 이 페이지만 히어로가 헤더 아래로 내려간다.
 * ImageHero를 쓰면서 이 선언을 빠뜨리는 것은 layout/heroHeader.test.ts가 막는다.
 */
MusicPromotion.hasHero = true;

export default MusicPromotion;
