import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { Banknote, BookOpen, Gift, ClipboardList, Info } from '@/lib/lucide-icons';
import type { LucideIcon } from '@/lib/lucide-icons';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import SectionHeading from '../../components/ui/SectionHeading';
import BaseCard from '../../components/ui/BaseCard';
import { Section } from '../../components/ui/Section';
import ServicePriceTable from '../../components/service/ServicePriceTable';
import ServiceLinkPill from '../../components/ui/ServiceLinkPill';
import { buildPageStaticProps } from '../../lib/getStatic';
import { defaultLocale, type Locale } from '../../lib/i18n';
import { getRouteLastmod, formatLastmodDate } from '../../lib/pageLastmod';
import { getSiteConfig } from '../../data/siteConfig';
import { FUNDING_DESIGN_PRICE } from '../../data/pricing';
import { crowdfundingDesignCopy as copy } from '../../data/crowdfundingDesign';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import type { NextPageWithLayout } from '../../types';

const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));

const SCOPE_ICONS: LucideIcon[] = [BookOpen, Gift, ClipboardList];

// 컴포넌트 밖에서 한 번만 계산한다. 항목이 없으면 null(가짜 날짜 금지, lib/pageLastmod.ts).
const LASTMOD_DISPLAY = formatLastmodDate(getRouteLastmod('/crowdfunding-design'));

type Props = {
  locale: Locale;
  relatedStories: StoryCardData[];
};

/**
 * 크라우드펀딩 설계 대행 — 2026-09-25 신설.
 *
 * 그 전까지 이 상품은 요금 페이지 부가 서비스 카드 한 장이 전부라, AI가 인용할 Service
 * 스키마·FAQ·가격표가 없었다(GEO S04 "음반 크라우드펀딩 준비하려는데 어디서 하나요"의
 * 착지점이 자체 플랫폼 /funding뿐이었다). 텀블벅 등 국내 플랫폼 상품이라 ko 전용이고,
 * 카피는 data/crowdfundingDesign.ts — 정본에 있는 사실만 싣는다(그 파일 주석).
 */
const CrowdfundingDesign: NextPageWithLayout<Props> = ({ locale, relatedStories }) => {
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const pageUrl = `${siteConfig.url}/ko/crowdfunding-design`;
  const faqItems = copy.faq.items.map((item) => ({ question: item.question, answer: item.answer }));

  const schema = React.useMemo(
    () =>
      buildSchemaGraph(
        buildStudioServiceSchema({
          locale,
          siteName: siteConfig.name,
          siteUrl: siteConfig.url,
          pageUrl,
          name: copy.hero.title,
          description: copy.seo.description,
          serviceType: '크라우드펀딩 설계 대행',
          offerName: copy.hero.title,
          offerPrice: FUNDING_DESIGN_PRICE,
          pricingHash: 'support-services',
        }),
        generateHowToSchema(
          copy.process.title,
          copy.process.subtitle,
          copy.process.steps.map((step) => ({ name: step.title, text: step.body }))
        )
      ),
    [locale, siteConfig, pageUrl]
  );

  return (
    <>
      <SEO
        locale={locale}
        title={copy.seo.title}
        description={copy.seo.description}
        keywords={copy.seo.keywords}
        includeSchema
        canonical="/ko/crowdfunding-design"
        breadcrumbs={[
          { name: '홈', path: '/ko' },
          { name: copy.hero.title, path: '/ko/crowdfunding-design' },
        ]}
        faqItems={faqItems}
        schema={schema}
      />

      <ImageHero
        locale={locale}
        priority
        // 얼굴이 보이지 않는 녹음 장면 — 이 상품이 모으는 돈이 향하는 곳(음반 제작)이다.
        backgroundImage="/images/service3.webp"
        imageAlt={copy.hero.alt}
        title={copy.hero.title}
        subtitle={
          <span className="block space-y-2">
            <span className="block">{copy.hero.line1}</span>
            <span className="block">{copy.hero.line2}</span>
            <span className="mt-4 inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">
              {copy.hero.badge}
            </span>
          </span>
        }
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="CrowdfundingDesignHero"
            ctaId="crowdfunding_design_hero_kakao"
            label={copy.hero.cta}
            phone={siteConfig.contact.phone}
          />
        }
      />

      {/* 가격·범위·실적을 시맨틱 <table>로 — AI가 옮기는 건 표·FAQ의 숫자다(#226). */}
      <Section variant="default" spacing="tight">
        <SectionHeading icon={Info} title={copy.facts.title} as="h2" className="mb-6" />
        <ServicePriceTable
          caption={copy.facts.title}
          serviceColLabel={copy.facts.serviceCol}
          priceColLabel={copy.facts.valueCol}
          groups={[
            {
              id: 'crowdfunding-design-facts',
              rows: copy.facts.rows.map((row) => ({ id: row.id, label: row.label, price: row.value })),
            },
          ]}
        />
      </Section>

      <Section variant="alternate">
        <SectionHeading icon={Banknote} title={copy.scope.title} subtitle={copy.scope.subtitle} />
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {copy.scope.items.map((item, index) => {
            const Icon = SCOPE_ICONS[index] ?? BookOpen;
            return (
              <BaseCard key={item.title} className="p-6">
                <Icon className="mb-4 h-8 w-8 text-primary dark:text-primary-lighter" aria-hidden="true" />
                <h3 className="typo-card-title mb-2 text-gray-900 dark:text-white">{item.title}</h3>
                <p className="typo-card-body text-gray-700 dark:text-gray-300">{item.body}</p>
              </BaseCard>
            );
          })}
        </div>
      </Section>

      <Section variant="default">
        <SectionHeading title={copy.process.title} subtitle={copy.process.subtitle} />
        <ol className="mx-auto max-w-3xl space-y-4">
          {copy.process.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="typo-card-title text-gray-900 dark:text-white">{step.title}</h3>
                <p className="typo-card-body text-gray-700 dark:text-gray-300">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section variant="alternate">
        <SectionHeading title={copy.alternatives.title} />
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {copy.alternatives.items.map((item) => (
            <BaseCard key={item.href} className="flex flex-col p-6">
              <h3 className="typo-card-title mb-2 text-gray-900 dark:text-white">{item.title}</h3>
              <p className="typo-card-body mb-4 flex-1 text-gray-700 dark:text-gray-300">{item.body}</p>
              <div>
                <ServiceLinkPill href={item.href}>{item.label}</ServiceLinkPill>
              </div>
            </BaseCard>
          ))}
        </div>
      </Section>

      <FAQSection title={copy.faq.title} subtitle={copy.faq.subtitle} items={faqItems} />

      {LASTMOD_DISPLAY && (
        <p className="pb-4 text-center text-xs text-gray-500 dark:text-gray-400">{LASTMOD_DISPLAY}</p>
      )}

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={copy.relatedStories.title}
        subtitle={copy.relatedStories.subtitle}
      />

      <ContactCTA
        locale={locale}
        icon={Banknote}
        title={
          <>
            {copy.cta.titleLine1}{' '}
            <span className="text-primary dark:text-primary-lighter">{copy.cta.titleHighlight}</span>
          </>
        }
        subtitle={copy.cta.subtitle}
        imageSrc="/images/console.webp"
        imageAlt={copy.cta.imageAlt}
      />
    </>
  );
};

// ko 전용 — 다른 로케일은 정적 파일이 없어 404다(lib/koOnlyRoutes.ts 규칙에 등록).
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: defaultLocale } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async () => {
  const relatedStories = getServiceRelatedStories('crowdfunding-design', defaultLocale);
  return buildPageStaticProps(defaultLocale, { relatedStories }, { i18nSections: ['stories'], revalidate: 86400 });
};

/** 히어로가 헤더 밑까지 풀블리드로 깔린다(Layout의 hasHero 분기, layout/heroHeader.test.ts). */
CrowdfundingDesign.hasHero = true;

export default CrowdfundingDesign;
