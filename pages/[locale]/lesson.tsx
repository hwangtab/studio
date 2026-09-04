import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { Mic2, Music, Sliders, Disc, CheckCircle, GraduationCap, BookOpen, CalendarDays, Clock, CalendarRange, Wallet } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import ServiceQuickLinksSection from '../../components/service/ServiceQuickLinksSection';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import HubLocaleContentSection from '../../components/ui/HubLocaleContentSection';
import SectionHeading from '../../components/ui/SectionHeading';
import CurriculumCard from '../../components/lesson/CurriculumCard';
import FormatCard from '../../components/lesson/FormatCard';
import PhaseHeader from '../../components/lesson/PhaseHeader';

// Below-fold 컴포넌트 code-splitting
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));
const HubLinkCallout = dynamic(() => import('../../components/guides/HubLinkCallout'));
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getHubLocaleContent } from '../../data/faq';
import { getSiteConfig } from '../../data/siteConfig';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import { LESSON_MONTHLY_PRICE, formatPriceAmount } from '../../data/pricing';
import { buildLessonServiceSchema } from '../../lib/lessonSchema';
import Link from 'next/link';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import type { StoryCardData } from '../../types/story';
import { createInViewEnterAnimation } from '../../utils/animationUtils';
import { createTranslatedQaItems } from '../../utils/translatedList';

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

    const lessonServiceSchema = React.useMemo(
        () => buildLessonServiceSchema({
            locale,
            siteName: siteConfig.name,
            siteUrl: siteConfig.url,
            title: t('lesson.seo.title'),
            description: t('lesson.seo.description'),
        }),
        [t, siteConfig, locale]
    );

    const lessonQuickAnswers = React.useMemo(
        () => createTranslatedQaItems(t, 'lesson.quickAnswers.items', 5),
        [t]
    );

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
                        <span className="block break-keep">{t('lesson.hero.subtitleLine1')}</span>
                        <span className="block break-keep">{t('lesson.hero.subtitleLine2')}</span>
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
                ctaButtons={
                    <HeroKakaoCta
                        locale={locale}
                        kakaoUrl={siteConfig.contact.kakaoUrl}
                        component="LessonHero"
                        ctaId="lesson_hero_kakao"
                        label={t('lesson.cta.inquiry')}
                    />
                }
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

            <HubLocaleContentSection content={hubLocaleContent} icon={BookOpen} />

            {/* Intro Section */}
            <Section variant="default">
                <SectionHeading
                    icon={GraduationCap}
                    title={
                        <>
                            <span className="block">{t('lesson.intro.titleLine1')}</span>
                            <span className="block text-primary">{t('lesson.intro.titleHighlight')}</span>
                        </>
                    }
                    subtitle={
                        <>
                            {/* 세 조각이 이어지는 한 단락이라 강제 개행 없이 자연 줄바꿈에 맡긴다.
                                고정 <br>은 조각이 먼저 감기는 폭에서 계단식 줄바꿈을 만들었다. */}
                            {t('lesson.intro.subtitleLine1')} {t('lesson.intro.subtitleLine2')}{' '}
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
                        />
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <HeroKakaoCta
                      locale={locale}
                      kakaoUrl={siteConfig.contact.kakaoUrl}
                      component="LessonPage"
                      ctaId="lesson_curriculum_kakao"
                      label={t('lesson.pricing.cta')}
                      surface="onSurface"
                    />
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
                        className="glass-card rounded-2xl overflow-hidden"
                    >
                        <div className="p-8 bg-gradient-to-br from-primary to-secondary text-white text-center">
                            <h3 className="typo-card-title text-white mb-2">{t('lesson.pricing.title')}</h3>
                            <p className="opacity-90">{t('lesson.pricing.subtitle')}</p>
                        </div>
                        <div className="p-8">
                            <div className="flex justify-center items-end mb-2">
                                <span className="text-4xl font-bold text-gray-800 dark:text-white">{formatPriceAmount(LESSON_MONTHLY_PRICE)}</span>
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
                            {/* 카카오 오픈채팅은 한국어 상담 채널이다. 비-ko는 /contact 폼으로
                                보내고 옐로도 쓰지 않는다(노란 버튼 = 카카오톡 규칙). */}
                            {locale === 'ko' ? (
                                <a
                                    href={siteConfig.contact.kakaoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() =>
                                        trackLeadEvent('lead_click_kakao', {
                                            locale,
                                            component: 'LessonPage',
                                            cta_id: 'lesson_pricing_kakao',
                                        })
                                    }
                                    className="block w-full text-center bg-kakao hover:bg-kakao-dark text-kakao-ink font-bold py-4 rounded-xl transition-colors duration-300"
                                >
                                    {t('lesson.pricing.cta')}
                                </a>
                            ) : (
                                <Link
                                    href={`/${locale}/contact`}
                                    prefetch={false}
                                    onClick={() =>
                                        trackMicroEvent('micro_click_contact', {
                                            locale,
                                            component: 'LessonPage',
                                            cta_id: 'lesson_pricing_contact',
                                        })
                                    }
                                    className="block w-full text-center bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl transition-colors duration-300"
                                >
                                    {t('lesson.pricing.cta')}
                                </Link>
                            )}
                        </div>
                    </m.div>
                </div>
            </Section>

            <ServiceQuickLinksSection
              variant="default"
              links={[
                { href: `/${locale}/practice-room`, label: t('nav.practiceRoom'), color: 'primary' },
                { href: `/${locale}/stories`, label: t('nav.stories'), color: 'secondary' },
                { href: `/${locale}/pricing`, label: t('nav.pricing'), color: 'accent' },
                { href: `/${locale}/contact`, label: t('nav.contact'), color: 'primary' },
              ]}
            />

            {/* 월 35만원 6개월 과정을 사회적 증거 없이 팔던 문제 해소 — 다른 서비스
                페이지와 동일하게 후기 섹션을 노출해 신뢰→행동 전환 고리를 만든다. */}
            <ReviewSection variant="default" locale={locale} />

            <HubLinkCallout
                hubSlug="vocal-beginners-guide"
                locale={locale}
                title={t('lesson.hubCallout.title', { defaultValue: '음원 발매를 목표로 하는 1:1 종합 레슨 가이드' })}
                subtitle={t('lesson.hubCallout.subtitle', { defaultValue: 'MIDI 작곡·믹싱·마스터링까지 — 현직 프로듀서 1:1 실전 커리큘럼과 학습 가이드를 한 페이지에 모았습니다.' })}
            />

            <RelatedStoriesSection
                stories={relatedStories}
                locale={locale}
                title={t('lesson.relatedStoriesTitle', { defaultValue: '레슨생들이 가장 많이 본 작곡·믹싱 가이드' })}
                subtitle={t('lesson.relatedStoriesSubtitle', { defaultValue: '작곡·믹싱·발매에 바로 도움이 되는 실전 가이드를 모았습니다.' })}
            />

            {/* Improved CTA Section */}
            <Section variant="alternate" className="py-16">
                <ContactCTA
                    locale={locale}
                    title={
                        <>
                            <span className="block">{t('lesson.cta.titleLine1')}</span>
                            <span className="block text-primary">{t('lesson.cta.titleHighlight')}</span>
                        </>
                    }
                    subtitle={
                        <>
                            <span className="block">{t('lesson.cta.subtitleLine1')}</span>
                            <span className="block">{t('lesson.cta.subtitleLine2')}</span>
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
        { revalidate: 86400, i18nSections: ['lesson', 'stories'] }
    );
};

export default Lesson;
