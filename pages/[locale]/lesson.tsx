import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import { motion } from 'framer-motion';
import { Mic2, Music, Sliders, Disc, CheckCircle, MessageCircle, Users, LucideIcon, GraduationCap, BookOpen, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import BaseCard from '../../components/ui/BaseCard';
import SectionHeading from '../../components/ui/SectionHeading';
import Link from 'next/link';
import { Section } from '../../components/ui/Section';
import { getCommonStaticPaths, getCommonStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface CurriculumCardProps {
    step: string;
    title: string;
    subtitle: string;
    description: string[];
    icon: LucideIcon;
    delay?: number;
}

const CurriculumCard = ({ step, title, subtitle, description, icon: Icon, delay = 0 }: CurriculumCardProps) => (
    <BaseCard variant="default" delay={delay} className="p-8 h-full relative overflow-hidden group hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
        <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-primary transition-transform group-hover:scale-110">
            {step}
        </div>
        <div className="relative z-10">
            <div className="bg-primary/10 dark:bg-primary/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-primary dark:text-primary-light">
                <Icon size={32} />
            </div>
            <h3 className="typo-card-title mb-1">{title}</h3>
            <p className="text-sm font-semibold text-primary mb-4">{subtitle}</p>
            <ul className="space-y-2">
                {description.map((item, idx) => (
                    <li key={idx} className="flex items-start typo-card-body text-body-2">
                        <CheckCircle size={14} className="mt-1 mr-2 text-primary flex-shrink-0" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </BaseCard>
);

const Lesson: NextPage<{ locale: Locale }> = ({ locale }) => {
    const { t } = useTranslation('common', { lng: locale });
    const getLink = (path: string) => `/${locale}${path}`;

    return (
        <>
            <SEO
                title={t('lesson.seo.title')}
                description={t('lesson.seo.description')}
                keywords="음원 발매 컨설팅, 믹싱 피드백, 미디 멘토링, 음원/앨범 제작 상담, 단기 미디 레슨, 큐베이스 원데이, 로직 프로 과외, 연신내 실용음악"
                canonical={`https://studionol.co.kr/${locale}/lesson`}
                includeSchema={true}
                breadcrumbs={[
                    { name: t('nav.home'), path: `/${locale}` },
                    { name: t('nav.lesson'), path: `/${locale}/lesson` },
                ]}
                ogImage="/images/lesson1.png"
            />
            <ImageHero
                title={t('lesson.hero.title')}
                subtitle={
                    <>
                        {t('lesson.hero.subtitleLine1')}
                        <br />
                        {t('lesson.hero.subtitleLine2')}
                    </>
                }
                backgroundImage="/images/lesson1.png"
                imageAlt={t('lesson.hero.alt')}
                minHeight="min-h-[60vh]"
                overlayGradient="from-black/40 via-transparent to-black/20"
            />

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

            {/* Curriculum Grid */}
            <Section variant="alternate">
                <SectionHeading
                    icon={BookOpen}
                    title={t('lesson.curriculum.title')}
                    as="h3"
                    className="mb-12"
                    titleClassName="text-heading-3"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <CurriculumCard
                        step="01"
                        title={t('lesson.curriculum.step1.title')}
                        subtitle={t('lesson.curriculum.step1.subtitle')}
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
                        icon={Mic2}
                        description={[
                            t('lesson.curriculum.step2.items.0'),
                            t('lesson.curriculum.step2.items.1'),
                            t('lesson.curriculum.step2.items.2'),
                            t('lesson.curriculum.step2.items.3'),
                        ]}
                        delay={0.2}
                    />
                    <CurriculumCard
                        step="03"
                        title={t('lesson.curriculum.step3.title')}
                        subtitle={t('lesson.curriculum.step3.subtitle')}
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
            </Section>

            {/* Why Choose Us & Pricing */}
            <Section variant="default">
                <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
                    {/* Why Choose Us */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <SectionHeading
                            title={t('lesson.why.title')}
                            as="h3"
                            align="left"
                            className="mb-8"
                        />
                        <div className="space-y-10">
                            <div className="flex">
                                <div className="bg-primary/10 p-4 rounded-xl h-fit mr-6">
                                    <Mic2 className="text-primary" size={32} />
                                </div>
                                <div>
                                    <h4 className="typo-card-title mb-3">{t('lesson.why.items.0.title')}</h4>
                                    <p className="typo-card-body text-gray-600 dark:text-gray-300">
                                        {t('lesson.why.items.0.body')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="bg-primary/10 p-4 rounded-xl h-fit mr-6">
                                    <Disc className="text-primary" size={32} />
                                </div>
                                <div>
                                    <h4 className="typo-card-title mb-3">{t('lesson.why.items.1.title')}</h4>
                                    <p className="typo-card-body text-gray-600 dark:text-gray-300">
                                        {t('lesson.why.items.1.body')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Pricing Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700"
                    >
                        <div className="p-8 bg-gradient-to-br from-primary to-secondary text-white text-center">
                            <h3 className="typo-card-title text-white mb-2">{t('lesson.pricing.title')}</h3>
                            <p className="opacity-90">{t('lesson.pricing.subtitle')}</p>
                        </div>
                        <div className="p-8">
                            <div className="flex justify-center items-end mb-6">
                                <span className="text-4xl font-bold text-gray-800 dark:text-white">350,000</span>
                                <span className="text-xl text-gray-500 mb-1 ml-1">{t('lesson.pricing.unit')}</span>
                            </div>
                            <a
                                href="https://open.kakao.com/me/nol"
                                target="_blank"
                                rel="noreferrer"
                                className="block w-full text-center bg-gray-900 dark:bg-gray-700 hover:bg-primary text-white font-bold py-4 rounded-xl transition-colors duration-300"
                            >
                                {t('lesson.pricing.cta')}
                            </a>
                        </div>
                    </motion.div>
                </div>
            </Section>

            {/* Improved CTA Section */}
            <Section variant="alternate">
                <motion.div
                    className="overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
                        <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
                            <SectionHeading
                                icon={Sparkles}
                                title={t('lesson.cta.title')}
                                subtitle={t('lesson.cta.subtitle')}
                                align="left"
                                className="mb-8"
                                as="h3"
                            />
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link href={getLink("/contact")} className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600">
                                    {t('lesson.cta.location')}
                                </Link>
                                <a
                                    href="https://open.kakao.com/me/nol"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                                >
                                    <MessageCircle className="mr-2" size={20} />
                                    {t('lesson.cta.inquiry')}
                                </a>
                            </div>
                        </div>
                        <div className="relative h-64 md:h-auto">
                            <ResponsiveImage
                                src="/images/lesson1.png"
                                alt={t('lesson.cta.imageAlt')}
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>
                </motion.div>
            </Section>
        </>
    );
};

(Lesson as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = getCommonStaticProps;

export default Lesson;
