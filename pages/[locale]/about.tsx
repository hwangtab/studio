import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Phone, Mail, MapPin, Music, Activity, Award, Headphones, Lightbulb, Banknote, Palette, Globe, Megaphone, Calendar, Users, Clock, MessageCircle, ArrowRight } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import BaseCard from '../../components/ui/BaseCard';
import HubLocaleContentSection from '../../components/ui/HubLocaleContentSection';
import ImageHero from '../../components/common/ImageHero';

// Below-fold 컴포넌트 code-splitting
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
import { getServicesData } from '../../data/services';
import { getHubLocaleContent } from '../../data/faq';
import { Section } from '../../components/ui/Section';
import type { LucideIcon } from '@/lib/lucide-icons';
import SectionHeading from '../../components/ui/SectionHeading';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { generateHowToSchema, generateServiceListSchema } from '../../utils/schema';
import { trackLeadEvent } from '../../utils/analytics';

import type { NextPageWithLayout } from '../../types';

const ICON_MAP: Record<string, LucideIcon> = {
  Lightbulb,
  Banknote,
  Headphones,
  Music,
  Palette,
  Globe,
  Megaphone,
  Calendar,
  Users,
  Clock,
  Activity,
  Award,
};

interface AboutProps {
  locale: Locale;
  servicesData: ReturnType<typeof getServicesData>;
  hubLocaleContent: ReturnType<typeof getHubLocaleContent>;
}

const About: NextPageWithLayout<AboutProps> = ({ locale, servicesData, hubLocaleContent }) => {
  const { t } = useTranslation('common', { lng: locale });

  const { coreServices, productionProcess, advantages } = servicesData;
  const siteConfig = getSiteConfig(locale);

  const howToSchema = React.useMemo(() => generateHowToSchema(
    t('about.howToTitle'),
    t('about.howToDescription'),
    productionProcess.map((step) => ({
      name: step.title,
      text: step.description,
    })),
    'P2D',
    locale
  ), [productionProcess, locale, t]);

  const serviceListSchema = React.useMemo(() => generateServiceListSchema(
    coreServices.map((service) => ({
      name: service.title,
      description: service.description,
    })),
    siteConfig.url,
    locale
  ), [coreServices, locale, siteConfig.url]);

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t('about.seo.title')}
        description={t('about.seo.description')}
        keywords={t('about.seo.keywords')}
        ogImage="/images/og-recording15.webp"
        ogImageAlt={t('about.heroAlt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.about'), path: `/${locale}/about` },
        ]}
        includeSchema={true}
        webPageType="AboutPage"
        canonical={`/${locale}/about`}
        schema={[howToSchema, serviceListSchema]}
      />
      <ImageHero
        {...{
          locale,
          priority: true,
          title: siteConfig.name,
          subtitle: (
            <>
              <span className="block">{t('about.subtitle')}</span>
              <span className="block">{t('about.description')}</span>
            </>
          ),
          backgroundImage: "/images/recording15.webp",
          imageAlt: t('about.heroAlt'),
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/40 via-transparent to-black/20",
          breadcrumbItems: [
            { name: t('nav.home'), path: `/${locale}` },
            { name: t('nav.about'), path: `/${locale}/about` },
          ],
        }}
      />


      <HubLocaleContentSection content={hubLocaleContent} icon={Globe} />

      {/* 대표 소개 — 의뢰는 사람을 믿고 맡기는 일. 신뢰 신호를 첫 콘텐츠 블록에 배치.
          ko 우선(트래픽 절대다수). 텍스트는 release-project 프로듀서 소개와 정합. */}
      {locale === 'ko' && (
        <Section variant="default">
          <div className="max-w-3xl mx-auto">
            <BaseCard variant="default" className="p-8">
              <div className="flex items-center gap-3 mb-2 text-primary dark:text-primary-lighter">
                <Award size={22} aria-hidden="true" />
                <span className="typo-card-meta font-semibold">{t('about.producer.tagline')}</span>
              </div>
              <h2 className="typo-card-title mb-4">{t('about.producer.title')}</h2>
              <p className="typo-card-body text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                {t('about.producer.body')}
              </p>
              {/* 카피가 "기획 단계부터 발매까지 한 손에서"라고 말하므로 그 발매를
                  보여줄 곳이 있어야 한다 — 포트폴리오(결과물)와 발매 프로젝트(과정) 둘 다 건다. */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/portfolio`}
                  prefetch={false}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-primary text-primary dark:text-primary-lighter font-semibold hover:bg-primary hover:text-white dark:hover:text-white transition-colors duration-200 min-h-[44px] touch-manipulation"
                >
                  {t('about.producer.portfolioCta')} <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  href={`/${locale}/release-project`}
                  prefetch={false}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-secondary text-secondary dark:text-secondary-light font-semibold hover:bg-secondary hover:text-white dark:hover:text-white transition-colors duration-200 min-h-[44px] touch-manipulation"
                >
                  {t('about.producer.releaseCta')} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </BaseCard>
          </div>
        </Section>
      )}

      <Section variant="alternate">
        <SectionHeading
          icon={Music}
          title={t('about.serviceTitle')}
          subtitle={t('about.serviceSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {coreServices.map((service) => (
            <FeatureCard
              key={service.title}
              title={service.title}
              description={service.description}
              icon={ICON_MAP[service.icon as string]}
              size="lg"
            />
          ))}
        </div>
      </Section>

      <Section variant="default">
        <SectionHeading
          icon={Activity}
          title={t('about.processTitle')}
          subtitle={t('about.processSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {productionProcess.map((step) => (
            <FeatureCard
              key={step.title}
              title={step.title}
              description={step.description}
              icon={ICON_MAP[step.icon as string]}
            />
          ))}
        </div>
      </Section>

      <Section variant="alternate">
        <SectionHeading
          icon={Award}
          title={t('about.differenceTitle')}
          subtitle={t('about.differenceSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <BaseCard
            variant="default"
            className="p-6"
          >
            <h3 className="typo-card-title mb-4">{t('about.package.title')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.0')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.1')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.2')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body">{t('about.package.items.3')}</p>
              </li>
            </ul>
          </BaseCard>

          <div className="grid grid-cols-2 gap-4">
            {advantages.map((advantage, index) => {
              const Icon = ICON_MAP[advantage.icon as string] || Users;
              return (
                <BaseCard
                  key={index}
                  variant="default"
                  className="p-4"
                >
                  <div className="flex items-center mb-2">
                    <Icon className="text-primary dark:text-primary-lighter mr-2" aria-hidden="true" />
                    <h3 className="typo-card-subtitle">{advantage.title}</h3>
                  </div>
                  <p className="typo-card-body">{advantage.description}</p>
                </BaseCard>
              );
            })}
          </div>
        </div>
      </Section>

      <Section variant="default">
        <SectionHeading
          icon={Headphones}
          title={t('contact.title')}
          subtitle={t('contact.subtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 이 4장 중 카카오만 계측돼 있어서 전화·이메일·지도 클릭이 통째로 유실됐다.
              about은 로컬 고객이 "누가 하는 곳인가"를 확인하고 전화하는 전형적 경로라,
              "전화 리드 90일 6건"이라는 수치 자체가 과소집계였다(2026-08-09 감사). */}
          <BaseCard
            className="p-6 text-center cursor-pointer"
            href={`tel:${siteConfig.contact.phone}`}
            onClick={() =>
              trackLeadEvent('lead_click_phone', {
                locale,
                component: 'AboutPage',
                cta_id: 'about_phone',
              })
            }
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <Phone className="text-primary dark:text-primary-lighter" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.call')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors">{siteConfig.contact.phone}</p>
          </BaseCard>

          <BaseCard
            className="p-6 text-center cursor-pointer"
            href={`mailto:${siteConfig.contact.email}`}
            onClick={() =>
              trackLeadEvent('lead_click_email', {
                locale,
                component: 'AboutPage',
                cta_id: 'about_email',
              })
            }
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <Mail className="text-primary dark:text-primary-lighter" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.email')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors">{siteConfig.contact.email}</p>
          </BaseCard>

          <BaseCard
            className="p-6 text-center cursor-pointer"
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'AboutPage',
                cta_id: 'about_kakao',
              })
            }
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <MessageCircle className="text-primary dark:text-primary-lighter" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.kakao')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors">{t('contact.info.kakao')}</p>
          </BaseCard>

          <BaseCard
            className="p-6 text-center cursor-pointer"
            href={siteConfig.contact.naverMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_naver_map', {
                locale,
                component: 'AboutPage',
                cta_id: 'about_naver_map',
              })
            }
          >
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                <MapPin className="text-primary dark:text-primary-lighter" size={20} aria-hidden="true" />
              </div>
            </div>
            <h3 className="typo-card-subtitle mb-2">{t('actions.location')}</h3>
            <p className="typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors">{siteConfig.contact.address}</p>
          </BaseCard>
        </div>
      </Section>

      <ReviewSection variant="default" locale={locale} />

      {/* 서비스 바로가기 — 본문 fold 안 button pill들. next/link 자동 prefetch가
          대상 페이지의 SSG JSON·청크를 동시 다운로드하지 않도록 prefetch={false}.
          hover/focus 시 prefetch는 next/link 기본 휴리스틱으로 그대로 작동. */}
      <Section variant="alternate" spacing="tight">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary dark:text-primary-lighter font-semibold hover:bg-primary hover:text-white dark:hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary dark:text-secondary-light font-semibold hover:bg-secondary hover:text-white dark:hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/lesson`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent dark:text-accent-light font-semibold hover:bg-accent hover:text-white dark:hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary dark:text-primary-lighter font-semibold hover:bg-primary hover:text-white dark:hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary dark:text-secondary-light font-semibold hover:bg-secondary hover:text-white dark:hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section variant="default">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('about.cta.titleLine1')}</span>
              <span className="block text-primary dark:text-primary-lighter">{t('about.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('about.cta.subtitleLine1')}</span>
              <span className="block">{t('about.cta.subtitleLine2')}</span>
            </>
          }
          imageSrc="/images/hardware3.webp"
          imageAlt={t('about.cta.imageAlt')}
          headingAs="h3"
        />
      </Section>
    </div>
  );
};

About.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<AboutProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const servicesData = getServicesData(locale);
  const hubLocaleContent = getHubLocaleContent(locale, 'about');

  return buildPageStaticProps(
    locale,
    {
      servicesData,
      hubLocaleContent,
    },
    { revalidate: 86400, i18nSections: ['about', 'contact'] }
  );
};

export default About;
