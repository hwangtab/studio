import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Mic2, Music, Sliders, Disc, CheckCircle, LucideIcon, ArrowRight, CalendarDays, Clock, CalendarRange, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import Hero from '../../components/ui/Hero';
import BaseCard from '../../components/ui/BaseCard';
import SectionHeading from '../../components/ui/SectionHeading';
import Section from '../../components/ui/Section';

// Below-fold 컴포넌트 code-splitting
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getHubLocaleContent } from '../../data/faq';
import { getSiteConfig } from '../../data/siteConfig';
import { getSchemaLanguage } from '../../utils/schemaGenerator';
import { createInViewEnterAnimation } from '../../utils/animationUtils';

import type { NextPageWithLayout } from '../../types';

interface CurriculumCardProps {
    step: string;
    title: string;
    subtitle: string;
    phaseLabel?: string;
    description: string[];
    icon: LucideIcon;
    delay?: number;
}

const CurriculumCard = ({ step, title, subtitle, phaseLabel, description, icon: Icon }: CurriculumCardProps) => (
    <BaseCard variant="default" hover className="p-8 h-full relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-ink transition-transform group-hover:scale-110">
            {step}
        </div>
        <div className="relative z-10">
            <div className="bg-canvas-warm rounded-pill p-3 inline-flex mb-6">
                <Icon size={32} className="text-ink" aria-hidden="true" />
            </div>
            {phaseLabel && (
                <span className="inline-block mb-3 px-3 py-1 rounded-pill bg-canvas-warm text-xs font-bold text-ink tracking-wide uppercase">
                    {phaseLabel}
                </span>
            )}
            <h3 className="text-title-md text-ink dark:text-on-dark mb-1">{title}</h3>
            <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft font-semibold mb-4">{subtitle}</p>
            <ul className="space-y-2">
                {description.map((item, idx) => (
                    <li key={idx} className="flex items-start text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">
                        <CheckCircle size={14} className="mt-1 mr-2 text-ink flex-shrink-0" aria-hidden="true" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </BaseCard>
);

interface FormatCardProps {
    icon: LucideIcon;
    label: string;
    value: string;
    caption: string;
}

const FormatCard = ({ icon: Icon, label, value, caption }: FormatCardProps) => (
    <BaseCard variant="default" hover className="p-6 h-full">
        <div className="flex items-start gap-4">
            <div className="bg-canvas-warm rounded-pill p-3 inline-flex flex-shrink-0">
                <Icon size={24} className="text-ink" aria-hidden="true" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-muted-60 tracking-wide uppercase mb-1">{label}</p>
                <p className="text-title-md text-ink dark:text-on-dark mb-1 break-keep">{value}</p>
                <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] break-keep">{caption}</p>
            </div>
        </div>
    </BaseCard>
);

interface PhaseHeaderProps {
    label: string;
    title: string;
    caption: string;
}

const PhaseHeader = ({ label, title, caption }: PhaseHeaderProps) => (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-6 border-l-4 border-hairline-strong pl-4">
        <div>
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-ink-muted-60 mb-1">{label}</span>
            <h3 className="text-title-md text-ink dark:text-on-dark">{title}</h3>
        </div>
        <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] md:text-right break-keep max-w-lg">{caption}</p>
    </div>
);

interface LessonProps {
    locale: Locale;
    hubLocaleContent: ReturnType<typeof getHubLocaleContent>;
}

const Lesson: NextPageWithLayout<LessonProps> = ({ locale, hubLocaleContent }) => {
    const { t } = useTranslation('common', { lng: locale });
    const siteConfig = getSiteConfig(locale);

    const whySectionRevealProps = createInViewEnterAnimation({ axis: 'x', distance: -20, duration: 0.6 });
    const pricingSectionRevealProps = createInViewEnterAnimation({ axis: 'x', distance: 20, duration: 0.6 });

    const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

    const lessonServiceSchema = React.useMemo(() => ({
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: t('lesson.seo.title'),
        description: t('lesson.seo.description'),
        inLanguage: schemaLanguage,
        serviceType: locale === 'ko' ? '음악 레슨' : 'Music Lesson',
        areaServed: [
            { '@type': 'AdministrativeArea', name: locale === 'ko' ? '서울특별시' : 'Seoul' },
            { '@type': 'AdministrativeArea', name: locale === 'ko' ? '은평구' : 'Eunpyeong-gu' },
            { '@type': 'Neighborhood', name: 'Yeonsinnae' },
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
        url: `${siteConfig.url}/${locale}/lesson`,
        provider: {
            '@type': 'Organization',
            '@id': `${siteConfig.url}/#organization`,
            name: siteConfig.name,
        },
    }), [t, siteConfig, locale, schemaLanguage]);

    const lessonQuickAnswers = React.useMemo(() => ([
        {
            question: t('lesson.quickAnswers.items.0.q'),
            answer: t('lesson.quickAnswers.items.0.a'),
        },
        {
            question: t('lesson.quickAnswers.items.1.q'),
            answer: t('lesson.quickAnswers.items.1.a'),
        },
        {
            question: t('lesson.quickAnswers.items.2.q'),
            answer: t('lesson.quickAnswers.items.2.a'),
        },
        {
            question: t('lesson.quickAnswers.items.3.q'),
            answer: t('lesson.quickAnswers.items.3.a'),
        },
        {
            question: t('lesson.quickAnswers.items.4.q'),
            answer: t('lesson.quickAnswers.items.4.a'),
        },
    ]), [t]);

    const lessonFormatItems = React.useMemo(() => ([
        {
            icon: CalendarDays,
            label: t('lesson.format.items.0.label'),
            value: t('lesson.format.items.0.value'),
            caption: t('lesson.format.items.0.caption'),
        },
        {
            icon: Clock,
            label: t('lesson.format.items.1.label'),
            value: t('lesson.format.items.1.value'),
            caption: t('lesson.format.items.1.caption'),
        },
        {
            icon: CalendarRange,
            label: t('lesson.format.items.2.label'),
            value: t('lesson.format.items.2.value'),
            caption: t('lesson.format.items.2.caption'),
        },
        {
            icon: Wallet,
            label: t('lesson.format.items.3.label'),
            value: t('lesson.format.items.3.value'),
            caption: t('lesson.format.items.3.caption'),
        },
    ]), [t]);

    return (
        <>
            <SEO
                locale={locale}
                title={t('lesson.seo.title')}
                description={t('lesson.seo.description')}
                keywords={t('lesson.seo.keywords')}
                includeSchema={true}
                isCourse
                faqItems={lessonQuickAnswers}
                breadcrumbs={[
                    { name: t('nav.home'), path: `/${locale}` },
                    { name: t('nav.lesson'), path: `/${locale}/lesson` },
                ]}
                ogImage="/images/lesson1.webp"
                ogImageAlt={t('lesson.hero.alt')}
                ogImageWidth={1280}
                ogImageHeight={720}
                webPageType="ItemPage"
                canonical={`/${locale}/lesson`}
                schema={lessonServiceSchema}
            />

            {/* Hero — lightEditorial with peach + mint orbs */}
            <Hero
                variant="lightEditorial"
                eyebrow={t('nav.lesson')}
                title={t('lesson.hero.title')}
                lead={t('lesson.hero.subtitleLine1')}
                primaryCta={{ label: t('lesson.pricing.cta'), href: siteConfig.contact.kakaoUrl }}
                orbs={[
                    { color: 'peach', size: 600, top: '-100px', right: '-80px', opacity: 0.4 },
                    { color: 'mint', size: 500, bottom: '-150px', left: '-100px', opacity: 0.35 },
                ]}
            />

            <QuickAnswers
                title={t('lesson.quickAnswers.title')}
                subtitle={t('lesson.quickAnswers.subtitle')}
                items={lessonQuickAnswers}
                tone="warm"
            />

            {/* Lesson Format — 주 1회 · 60분 · 6개월 · 월 35만원 한눈에 */}
            <Section tone="canvas">
                <SectionHeading
                    eyebrow="Lesson Format"
                    title={t('lesson.format.title')}
                    lead={t('lesson.format.subtitle')}
                    as="h2"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                    {lessonFormatItems.map((item) => (
                        <FormatCard
                            key={item.label}
                            icon={item.icon}
                            label={item.label}
                            value={item.value}
                            caption={item.caption}
                        />
                    ))}
                </div>
                <p className="mt-6 text-center text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] break-keep">
                    {t('lesson.format.note')}
                </p>
            </Section>

            {/* Locale-specific content block (non-KO hubs only) */}
            {hubLocaleContent && (
              <Section tone="warm">
                <SectionHeading
                  eyebrow="Local Info"
                  title={hubLocaleContent.title} marginBottom="tight"
                />
                <div className="max-w-4xl mx-auto space-y-6">
                  {hubLocaleContent.items.map((item) => (
                    <BaseCard key={item.heading} variant="default" hover className="p-6">
                      <h3 className="text-title-md text-ink dark:text-on-dark mb-3">{item.heading}</h3>
                      <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">{item.body}</p>
                    </BaseCard>
                  ))}
                </div>
              </Section>
            )}

            {/* Intro Section */}
            <Section tone="canvas">
                <SectionHeading
                    eyebrow="Our Approach"
                    title={
                        <>
                            {t('lesson.intro.titleLine1')}{' '}
                            {t('lesson.intro.titleHighlight')}
                        </>
                    }
                    lead={
                        <>
                            {t('lesson.intro.subtitleLine1')}{' '}
                            {t('lesson.intro.subtitleLine2')}{' '}
                            {t('lesson.intro.subtitleLine3')}
                        </>
                    }
                    className="mb-16"
                    as="h2"
                />
            </Section>

            {/* Curriculum Roadmap — 기본 3개월 + 심화 3개월 */}
            <Section tone="warm">
                <SectionHeading
                    eyebrow="Curriculum"
                    title={t('lesson.curriculum.title')}
                    lead={t('lesson.curriculum.subtitle')}
                    as="h2"
                />

                {/* Phase 1 — 기본 3개월 과정 */}
                <div className="mb-12">
                    <PhaseHeader
                        label={t('lesson.curriculum.phase1.label')}
                        title={t('lesson.curriculum.phase1.title')}
                        caption={t('lesson.curriculum.phase1.caption')}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <CurriculumCard
                            step="01"
                            title={t('lesson.curriculum.step1.title')}
                            subtitle={t('lesson.curriculum.step1.subtitle')}
                            phaseLabel={t('lesson.curriculum.step1.phaseLabel')}
                            icon={Music}
                            description={[
                                t('lesson.curriculum.step1.items.0'),
                                t('lesson.curriculum.step1.items.1'),
                                t('lesson.curriculum.step1.items.2'),
                                t('lesson.curriculum.step1.items.3'),
                            ]}
                            delay={0.1}
                        />
                        <CurriculumCard
                            step="02"
                            title={t('lesson.curriculum.step2.title')}
                            subtitle={t('lesson.curriculum.step2.subtitle')}
                            phaseLabel={t('lesson.curriculum.step2.phaseLabel')}
                            icon={Mic2}
                            description={[
                                t('lesson.curriculum.step2.items.0'),
                                t('lesson.curriculum.step2.items.1'),
                                t('lesson.curriculum.step2.items.2'),
                                t('lesson.curriculum.step2.items.3'),
                            ]}
                            delay={0.2}
                        />
                    </div>
                </div>

                {/* Phase 2 — 심화 3개월 과정 */}
                <div>
                    <PhaseHeader
                        label={t('lesson.curriculum.phase2.label')}
                        title={t('lesson.curriculum.phase2.title')}
                        caption={t('lesson.curriculum.phase2.caption')}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <CurriculumCard
                            step="03"
                            title={t('lesson.curriculum.step3.title')}
                            subtitle={t('lesson.curriculum.step3.subtitle')}
                            phaseLabel={t('lesson.curriculum.step3.phaseLabel')}
                            icon={Sliders}
                            description={[
                                t('lesson.curriculum.step3.items.0'),
                                t('lesson.curriculum.step3.items.1'),
                                t('lesson.curriculum.step3.items.2'),
                                t('lesson.curriculum.step3.items.3'),
                            ]}
                            delay={0.3}
                        />
                        <CurriculumCard
                            step="04"
                            title={t('lesson.curriculum.step4.title')}
                            subtitle={t('lesson.curriculum.step4.subtitle')}
                            phaseLabel={t('lesson.curriculum.step4.phaseLabel')}
                            icon={Disc}
                            description={[
                                t('lesson.curriculum.step4.items.0'),
                                t('lesson.curriculum.step4.items.1'),
                                t('lesson.curriculum.step4.items.2'),
                                t('lesson.curriculum.step4.items.3'),
                            ]}
                            delay={0.4}
                        />
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <a
                        href={siteConfig.contact.kakaoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-pill bg-ink text-white font-bold text-lg hover:bg-canvas-deep transition-colors duration-200"
                    >
                        {t('lesson.pricing.cta')}
                    </a>
                </div>
            </Section>

            {/* Why Choose Us & Pricing */}
            <Section tone="canvas">
                <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
                    {/* Why Choose Us */}
                    <m.div
                        {...whySectionRevealProps}
                    >
                        <SectionHeading
                            title={t('lesson.why.title')}
                            as="h2"
                            align="left" marginBottom="tight"
                        />
                        <div className="space-y-10">
                            <div className="flex">
                                <div className="bg-canvas-warm p-4 rounded-card h-fit mr-6">
                                    <Mic2 className="text-ink" size={32} aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-title-md text-ink dark:text-on-dark mb-3">{t('lesson.why.items.0.title')}</h3>
                                    <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">
                                        {t('lesson.why.items.0.body')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="bg-canvas-warm p-4 rounded-card h-fit mr-6">
                                    <Disc className="text-ink" size={32} aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-title-md text-ink dark:text-on-dark mb-3">{t('lesson.why.items.1.title')}</h3>
                                    <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">
                                        {t('lesson.why.items.1.body')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </m.div>

                    {/* Pricing Card */}
                    <m.div
                        {...pricingSectionRevealProps}
                        className="bg-canvas-soft dark:bg-surface-dark-elevated rounded-hero shadow-card overflow-hidden border border-hairline dark:border-white/10"
                    >
                        <div className="p-8 bg-canvas-deep text-on-dark text-center">
                            <h3 className="text-title-md text-on-dark mb-2">{t('lesson.pricing.title')}</h3>
                            <p className="text-on-dark-soft">{t('lesson.pricing.subtitle')}</p>
                        </div>
                        <div className="p-8">
                            <div className="flex justify-center items-end mb-2">
                                <span className="text-4xl font-bold text-ink dark:text-on-dark">350,000</span>
                                <span className="text-xl text-ink-muted-60 mb-1 ml-1">{t('lesson.pricing.unit')}</span>
                            </div>
                            <p className="text-center text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] mb-6 break-keep">
                                {t('lesson.pricing.breakdown')}
                            </p>
                            <ul className="space-y-2 mb-6 text-[15px] text-ink-muted-80 dark:text-on-dark-soft">
                                <li className="flex items-start">
                                    <CheckCircle size={16} className="mt-0.5 mr-2 text-ink flex-shrink-0" aria-hidden="true" />
                                    <span className="break-keep">{t('lesson.format.items.0.label')}: <strong>{t('lesson.format.items.0.value')}</strong></span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle size={16} className="mt-0.5 mr-2 text-ink flex-shrink-0" aria-hidden="true" />
                                    <span className="break-keep">{t('lesson.format.items.1.label')}: <strong>{t('lesson.format.items.1.value')}</strong></span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle size={16} className="mt-0.5 mr-2 text-ink flex-shrink-0" aria-hidden="true" />
                                    <span className="break-keep">{t('lesson.format.items.2.label')}: <strong>{t('lesson.format.items.2.value')}</strong></span>
                                </li>
                            </ul>
                            <a
                                href={siteConfig.contact.kakaoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full text-center bg-canvas-deep dark:bg-surface-dark-elevated hover:opacity-90 text-on-dark font-bold py-4 rounded-card transition-colors duration-300"
                            >
                                {t('lesson.pricing.cta')}
                            </a>
                        </div>
                    </m.div>
                </div>
            </Section>

            {/* 관련 서비스 바로가기 */}
            <Section tone="warm" paddingY="sm">
                <div className="flex flex-wrap justify-center gap-4">
                    <Link
                        href={`/${locale}/practice-room`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink hover:text-white transition-colors duration-200"
                    >
                        {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link
                        href={`/${locale}/stories`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink hover:text-white transition-colors duration-200"
                    >
                        {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link
                        href={`/${locale}/pricing`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink hover:text-white transition-colors duration-200"
                    >
                        {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link
                        href={`/${locale}/contact`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink hover:text-white transition-colors duration-200"
                    >
                        {t('nav.contact')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>
            </Section>

            {/* Final CTA Section */}
            <Section tone="deep" orbs={[{ color: 'mint', size: 600, top: '-100px', right: '-80px', opacity: 0.5 }]} paddingY="default">
                <ContactCTA
                    locale={locale}
                    title={
                        <>
                            {t('lesson.cta.titleLine1')}<br />
                            <span>{t('lesson.cta.titleHighlight')}</span>
                        </>
                    }
                    subtitle={
                        <>
                            {t('lesson.cta.subtitleLine1')}<br className="hidden md:block" />
                            {t('lesson.cta.subtitleLine2')}
                        </>
                    }
                    imageSrc="/images/lesson1.webp"
                    imageAlt={t('lesson.cta.imageAlt')}
                    primaryButtonLabel={t('lesson.cta.inquiry')}
                    secondaryButtonLabel={t('lesson.cta.location')}
                    headingAs="h3"
                />
            </Section>
        </>
    );
};

Lesson.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
    const locale = resolveLocaleParam(params?.locale);
    const hubLocaleContent = getHubLocaleContent(locale, 'lesson');
    return buildPageStaticProps(
        locale,
        {
            hubLocaleContent,
        },
        { revalidate: 86400, i18nSections: ['lesson'] }
    );
};

export default Lesson;
