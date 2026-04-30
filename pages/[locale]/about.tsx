import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LucideIcon, Phone, Mail, MapPin, Music, Activity, Award, Headphones, Lightbulb, Banknote, Palette, Globe, Megaphone, Calendar, Users, Clock, MessageCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import FeatureCard from '../../components/ui/FeatureCard';
import BaseCard from '../../components/ui/BaseCard';
import ImageHero from '../../components/common/ImageHero';

// Below-fold 컴포넌트 code-splitting
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
import { getServicesData } from '../../data/services';
import { getHubLocaleContent } from '../../data/faq';
import Section from '../../components/ui/Section';
import SectionHeading from '../../components/ui/SectionHeading';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { generateHowToSchema, generateServiceListSchema } from '../../utils/schemaGenerator';

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
        ogImage="/images/recording15.webp"
        ogImageAlt={t('about.heroAlt')}
        ogImageWidth={1280}
        ogImageHeight={854}
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
              {t('about.subtitle')}
              <br />
              {t('about.description')}
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
          orbs: [
            { color: 'peach', size: 500, top: '10%', left: '-80px', opacity: 0.3 },
            { color: 'sky', size: 400, top: '20%', right: '-60px', opacity: 0.25 },
          ],
        }}
      />


      {/* Locale-specific content block (non-KO hubs only) */}
      {hubLocaleContent && (
        <Section tone="warm">
          <SectionHeading
            title={hubLocaleContent.title}
            className="mb-8"
          />
          <div className="max-w-4xl mx-auto space-y-6">
            {hubLocaleContent.items.map((item) => (
              <BaseCard key={item.heading} variant="default" className="p-6">
                <h3 className="typo-card-title mb-3 text-primary">{item.heading}</h3>
                <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft">{item.body}</p>
              </BaseCard>
            ))}
          </div>
        </Section>
      )}

      <Section tone="warm">
        <SectionHeading
          title={t('about.serviceTitle')}
          lead={t('about.serviceSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {coreServices.map((service, index) => (
            <FeatureCard
              key={service.title}
              title={service.title}
              description={service.description}
              icon={ICON_MAP[service.icon as string]}
              delay={0.1 * (index + 1)}
              size="lg"
            />
          ))}
        </div>
      </Section>

      <Section tone="canvas">
        <SectionHeading
          title={t('about.processTitle')}
          lead={t('about.processSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {productionProcess.map((step, index) => (
            <FeatureCard
              key={step.title}
              title={step.title}
              description={step.description}
              icon={ICON_MAP[step.icon as string]}
              delay={0.1 * (index + 1)}
            />
          ))}
        </div>
      </Section>

      <Section tone="warm">
        <SectionHeading
          title={t('about.differenceTitle')}
          lead={t('about.differenceSubtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <BaseCard
            variant="default"
            className="p-6"
          >
            <h3 className="typo-card-title mb-4 text-ink dark:text-on-dark">{t('about.package.title')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft">{t('about.package.items.0')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft">{t('about.package.items.1')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft">{t('about.package.items.2')}</p>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mt-2 mr-2"></span>
                <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft">{t('about.package.items.3')}</p>
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
                  hover
                  className="p-4"
                >
                  <div className="flex items-center mb-2">
                    <Icon className="text-primary dark:text-primary-light mr-2" aria-hidden="true" />
                    <h3 className="typo-card-subtitle text-ink dark:text-on-dark">{advantage.title}</h3>
                  </div>
                  <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft">{advantage.description}</p>
                </BaseCard>
              );
            })}
          </div>
        </div>
      </Section>

      <Section tone="canvas">
        <SectionHeading
          title={t('contact.title')}
          lead={t('contact.subtitle')}
          className="mb-12"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <a
            href={`tel:${siteConfig.contact.phone}`}
            className="block"
          >
            <BaseCard
              hover
              className="p-6 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <Phone className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-ink dark:text-on-dark">{t('actions.call')}</h3>
              <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft hover:text-primary dark:hover:text-primary-light transition-colors">{siteConfig.contact.phone}</p>
            </BaseCard>
          </a>

          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="block"
          >
            <BaseCard
              hover
              className="p-6 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <Mail className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-ink dark:text-on-dark">{t('actions.email')}</h3>
              <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft hover:text-primary dark:hover:text-primary-light transition-colors">{siteConfig.contact.email}</p>
            </BaseCard>
          </a>

          <a
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <BaseCard
              hover
              className="p-6 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <MessageCircle className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-ink dark:text-on-dark">{t('actions.kakao')}</h3>
              <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft hover:text-primary dark:hover:text-primary-light transition-colors">{t('contact.info.kakao')}</p>
            </BaseCard>
          </a>

          <a
            href={siteConfig.contact.naverMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <BaseCard
              hover
              className="p-6 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-4 rounded-full">
                  <MapPin className="text-primary dark:text-primary-light" size={20} aria-hidden="true" />
                </div>
              </div>
              <h3 className="typo-card-subtitle mb-2 text-ink dark:text-on-dark">{t('actions.location')}</h3>
              <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft hover:text-primary dark:hover:text-primary-light transition-colors">{siteConfig.contact.address}</p>
            </BaseCard>
          </a>
        </div>
      </Section>

      <ReviewSection variant="default" locale={locale} />

      {/* 서비스 바로가기 — 본문 fold 안 button pill들. next/link 자동 prefetch가
          대상 페이지의 SSG JSON·청크를 동시 다운로드하지 않도록 prefetch={false}.
          hover/focus 시 prefetch는 next/link 기본 휴리스틱으로 그대로 작동. */}
      <Section tone="warm" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/lesson`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section
        tone="deep"
        orbs={[{ color: 'mint', size: 600, top: '-100px', right: '-80px', opacity: 0.5 }]}
        className="py-16"
      >
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('about.cta.titleLine1')}<br />
              <span className="text-primary">{t('about.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('about.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('about.cta.subtitleLine2')}
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
