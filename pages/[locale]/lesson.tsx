import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Mic2, Music, Sliders, Disc, CheckCircle, GraduationCap, BookOpen, ArrowRight, CalendarDays, Clock, CalendarRange, Wallet } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import BaseCard from '../../components/ui/BaseCard';
import SectionHeading from '../../components/ui/SectionHeading';
import CurriculumCard from '../../components/lesson/CurriculumCard';
import FormatCard from '../../components/lesson/FormatCard';
import PhaseHeader from '../../components/lesson/PhaseHeader';

// Below-fold 컴포넌트 code-splitting
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));
const HubLinkCallout = dynamic(() => import('../../components/guides/HubLinkCallout'));
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getHubLocaleContent } from '../../data/faq';
import { getSiteConfig } from '../../data/siteConfig';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { getSchemaLanguage } from '../../utils/schemaGenerator';
import { createInViewEnterAnimation } from '../../utils/animationUtils';

import type { NextPageWithLayout } from '../../types';

interface LessonProps {
    locale: Locale;
    hubLocaleContent: ReturnType<typeof getHubLocaleContent>;
    relatedStories: StoryCardData[];
}

const Lesson: NextPageWithLayout<LessonProps> = ({ locale, hubLocaleContent, relatedStories }) => {
    const { t } = useTranslation('common', { lng: locale });
    const siteConfig = getSiteConfig(locale);

    const whySectionRevealProps = createInViewEnterAnimation({ axis: 'x', distance: -20, duration: 0.6 });
    const pricingSectionRevealProps = createInViewEnterAnimation({ axis: 'x', distance: 20, duration: 0.6 });

    const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

    const lessonServiceSchema = React.useMemo(() => ({
        '@context': 'https://schema.org',
        '@type': 'Service',
        // 동 페이지에 Course schema(#course @id)도 발행되므로 entity 충돌을 피하기 위해
        // Service에 별도 @id 부여. Rich Results가 두 entity를 명확히 구분해 surface.
        '@id': `${siteConfig.url}/${locale}/lesson#service`,
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
                ogImage="/images/og-lesson1.webp"
                ogImageAlt={t('lesson.hero.alt')}
                ogImageWidth={1200}
                ogImageHeight={630}
                webPageType="ItemPage"
                canonical={`/${locale}/lesson`}
                schema={lessonServiceSchema}
            />
            <ImageHero
                locale={locale}
                priority
                title={t('lesson.hero.title')}
                subtitle={
                    <>
                        <span className="break-keep">{t('lesson.hero.subtitleLine1')}</span>
                        <br />
                        <span className="break-keep">{t('lesson.hero.subtitleLine2')}</span>
                        <br />
                        <span className="inline-block mt-3 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-base md:text-lg font-semibold break-keep">
                            {t('lesson.hero.subtitleLine3')}
                        </span>
                    </>
                }
                backgroundImage="/images/lesson1.webp"
                imageAlt={t('lesson.hero.alt')}
                minHeight="min-h-[60vh]"
                overlayGradient="from-black/40 via-transparent to-black/20"
                breadcrumbItems={[
                    { name: t('nav.home'), path: `/${locale}` },
                    { name: t('nav.lesson'), path: `/${locale}/lesson` },
                ]}
            />

            <QuickAnswers
                title={t('lesson.quickAnswers.title')}
                subtitle={t('lesson.quickAnswers.subtitle')}
                items={lessonQuickAnswers}
                variant="default"
            />

            {/* Lesson Format — 주 1회 · 60분 · 6개월 · 월 35만원 한눈에 */}
            <Section variant="alternate">
                <SectionHeading
                    icon={CalendarDays}
                    title={t('lesson.format.title')}
                    subtitle={t('lesson.format.subtitle')}
                    as="h2"
                    className="mb-10"
                    titleClassName="text-heading-3"
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
                <p className="mt-6 text-center text-body-2 text-gray-600 dark:text-gray-300 break-keep">
                    {t('lesson.format.note')}
                </p>
            </Section>

            {/* Locale-specific content block (non-KO hubs only) */}
            {hubLocaleContent && (
              <Section variant="alternate">
                <SectionHeading
                  icon={BookOpen}
                  title={hubLocaleContent.title}
                  className="mb-8"
                />
                <div className="max-w-4xl mx-auto space-y-6">
                  {hubLocaleContent.items.map((item) => (
                    <BaseCard key={item.heading} variant="default" className="p-6">
                      <h3 className="typo-card-title mb-3 text-primary">{item.heading}</h3>
                      <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>
                    </BaseCard>
                  ))}
                </div>
              </Section>
            )}

            {/* Intro Section */}
            <Section variant="default">
                <SectionHeading
                    icon={GraduationCap}
                    title={
                        <>
                            {t('lesson.intro.titleLine1')}<br />
                            <span className="text-primary">{t('lesson.intro.titleHighlight')}</span>
                        </>
                    }
                    subtitle={
                        <>
                            {t('lesson.intro.subtitleLine1')} <br className="hidden md:block" />
                            {t('lesson.intro.subtitleLine2')} <br className="hidden md:block" />
                            <strong>{t('lesson.intro.subtitleLine3')}</strong>
                        </>
                    }
                    className="mb-16"
                />
            </Section>

            {/* Curriculum Roadmap — 기본 3개월 + 심화 3개월 */}
            <Section variant="alternate">
                <SectionHeading
                    icon={BookOpen}
                    title={t('lesson.curriculum.title')}
                    subtitle={t('lesson.curriculum.subtitle')}
                    as="h2"
                    className="mb-12"
                    titleClassName="text-heading-3"
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
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-white font-bold text-lg hover:bg-primary-dark transition-colors duration-200"
                    >
                        {t('lesson.pricing.cta')}
                    </a>
                </div>
            </Section>

            {/* Why Choose Us & Pricing */}
            <Section variant="default">
                <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
                    {/* Why Choose Us */}
                    <m.div
                        {...whySectionRevealProps}
                    >
                        <SectionHeading
                            title={t('lesson.why.title')}
                            as="h2"
                            align="left"
                            className="mb-8"
                        />
                        <div className="space-y-10">
                            <div className="flex">
                                <div className="bg-primary/10 p-4 rounded-xl h-fit mr-6">
                                    <Mic2 className="text-primary" size={32} aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="typo-card-title mb-3">{t('lesson.why.items.0.title')}</h3>
                                    <p className="typo-card-body text-gray-600 dark:text-gray-300">
                                        {t('lesson.why.items.0.body')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="bg-primary/10 p-4 rounded-xl h-fit mr-6">
                                    <Disc className="text-primary" size={32} aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="typo-card-title mb-3">{t('lesson.why.items.1.title')}</h3>
                                    <p className="typo-card-body text-gray-600 dark:text-gray-300">
                                        {t('lesson.why.items.1.body')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </m.div>

                    {/* Pricing Card */}
                    <m.div
                        {...pricingSectionRevealProps}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700"
                    >
                        <div className="p-8 bg-gradient-to-br from-primary to-secondary text-white text-center">
                            <h3 className="typo-card-title text-white mb-2">{t('lesson.pricing.title')}</h3>
                            <p className="opacity-90">{t('lesson.pricing.subtitle')}</p>
                        </div>
                        <div className="p-8">
                            <div className="flex justify-center items-end mb-2">
                                <span className="text-4xl font-bold text-gray-800 dark:text-white">350,000</span>
                                <span className="text-xl text-gray-500 mb-1 ml-1">{t('lesson.pricing.unit')}</span>
                            </div>
                            <p className="text-center text-body-2 text-gray-600 dark:text-gray-300 mb-6 break-keep">
                                {t('lesson.pricing.breakdown')}
                            </p>
                            <ul className="space-y-2 mb-6 text-body-2 text-gray-700 dark:text-gray-200">
                                <li className="flex items-start">
                                    <CheckCircle size={16} className="mt-0.5 mr-2 text-primary flex-shrink-0" aria-hidden="true" />
                                    <span className="break-keep">{t('lesson.format.items.0.label')}: <strong>{t('lesson.format.items.0.value')}</strong></span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle size={16} className="mt-0.5 mr-2 text-primary flex-shrink-0" aria-hidden="true" />
                                    <span className="break-keep">{t('lesson.format.items.1.label')}: <strong>{t('lesson.format.items.1.value')}</strong></span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle size={16} className="mt-0.5 mr-2 text-primary flex-shrink-0" aria-hidden="true" />
                                    <span className="break-keep">{t('lesson.format.items.2.label')}: <strong>{t('lesson.format.items.2.value')}</strong></span>
                                </li>
                            </ul>
                            <a
                                href={siteConfig.contact.kakaoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full text-center bg-gray-900 dark:bg-gray-700 hover:bg-primary text-white font-bold py-4 rounded-xl transition-colors duration-300"
                            >
                                {t('lesson.pricing.cta')}
                            </a>
                        </div>
                    </m.div>
                </div>
            </Section>

            {/* 관련 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
                무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
            <Section variant="default" className="py-10">
                <div className="flex flex-wrap justify-center gap-4">
                    <Link
                        href={`/${locale}/practice-room`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
                    >
                        {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link
                        href={`/${locale}/stories`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
                    >
                        {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link
                        href={`/${locale}/pricing`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
                    >
                        {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link
                        href={`/${locale}/contact`}
                        prefetch={false}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
                    >
                        {t('nav.contact')} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>
            </Section>

            <HubLinkCallout
                hubSlug="vocal-beginners-guide"
                locale={locale}
                title="음원 발매를 목표로 하는 1:1 종합 레슨 가이드"
                subtitle="보컬·MIDI 작곡·믹싱·마스터링까지 — 현직 프로듀서 1:1 실전 커리큘럼과 학습 가이드를 한 페이지에 모았습니다."
            />

            <RelatedStoriesSection
                stories={relatedStories}
                locale={locale}
                title={t('lesson.relatedStoriesTitle', { defaultValue: '레슨생들이 가장 많이 본 보컬·연습 가이드' })}
                subtitle={t('lesson.relatedStoriesSubtitle', { defaultValue: '오디션·발성·음감 훈련에 바로 도움이 되는 실전 가이드를 모았습니다.' })}
            />

            {/* Improved CTA Section */}
            <Section variant="alternate" className="py-16">
                <ContactCTA
                    locale={locale}
                    title={
                        <>
                            {t('lesson.cta.titleLine1')}<br />
                            <span className="text-primary">{t('lesson.cta.titleHighlight')}</span>
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
    const relatedStories = getServiceRelatedStories('lesson', locale);
    return buildPageStaticProps(
        locale,
        {
            hubLocaleContent,
            relatedStories,
        },
        { revalidate: 86400, i18nSections: ['lesson'] }
    );
};

export default Lesson;
