import React, { useRef } from 'react';
import Link from 'next/link';
import { m, useInView } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Music, Mic2, Settings, BookOpen, GraduationCap, Lightbulb, MapPin, Speaker, Clock } from 'lucide-react';
import { createInViewEnterAnimation } from '../utils/animationUtils';


import type { Locale } from '../lib/i18n';

export type CTAType = 'recording' | 'lesson' | 'practice' | 'production';

interface StoryCTAProps {
    type?: CTAType;
    locale?: Locale;
}

const StoryCTA: React.FC<StoryCTAProps> = ({ type = 'recording', locale = 'ko' }) => {
    const { t } = useTranslation('common', { lng: locale });

    const getLink = (path: string) => `/${locale}${path}`;

    const content = {
        recording: {
            accentColor: 'text-orb-lavender',
            accentBg: 'bg-orb-lavender',
            icons: (
                <>
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-orb-lavender rounded-full" />
                    <Settings size={20} />
                    <span className="w-1 h-1 bg-orb-lavender rounded-full" />
                    <Music size={20} />
                </>
            ),
            title: t('stories.cta.recording.title'),
            description: (
                <>
                    {t('stories.cta.recording.descriptionLine1')}<br className="hidden md:block" />
                    {t('stories.cta.recording.descriptionLine2')}
                </>
            ),
            primaryLink: getLink('/pricing'),
            primaryText: t('stories.cta.recording.primaryText'),
            secondaryLink: getLink('/contact'),
            secondaryText: t('stories.cta.recording.secondaryText'),
            visualText: t('stories.cta.recording.visualText'),
            visualGradient: 'from-orb-lavender to-orb-sky',
        },
        lesson: {
            accentColor: 'text-orb-peach',
            accentBg: 'bg-orb-peach',
            icons: (
                <>
                    <BookOpen size={20} />
                    <span className="w-1 h-1 bg-orb-peach rounded-full" />
                    <Lightbulb size={20} />
                    <span className="w-1 h-1 bg-orb-peach rounded-full" />
                    <GraduationCap size={20} />
                </>
            ),
            title: t('stories.cta.lesson.title'),
            description: (
                <>
                    {t('stories.cta.lesson.descriptionLine1')}<br className="hidden md:block" />
                    {t('stories.cta.lesson.descriptionLine2')}
                </>
            ),
            primaryLink: getLink('/lesson'),
            primaryText: t('stories.cta.lesson.primaryText'),
            secondaryLink: getLink('/contact'),
            secondaryText: t('stories.cta.lesson.secondaryText'),
            visualText: t('stories.cta.lesson.visualText'),
            visualGradient: 'from-orb-peach to-orb-rose',
        },
        practice: {
            accentColor: 'text-orb-mint',
            accentBg: 'bg-orb-mint',
            icons: (
                <>
                    <MapPin size={20} />
                    <span className="w-1 h-1 bg-orb-mint rounded-full" />
                    <Clock size={20} />
                    <span className="w-1 h-1 bg-orb-mint rounded-full" />
                    <Speaker size={20} />
                </>
            ),
            title: t('stories.cta.practice.title'),
            description: (
                <>
                    {t('stories.cta.practice.descriptionLine1')}<br className="hidden md:block" />
                    {t('stories.cta.practice.descriptionLine2')}
                </>
            ),
            primaryLink: getLink('/practice-room'),
            primaryText: t('stories.cta.practice.primaryText'),
            secondaryLink: getLink('/contact'),
            secondaryText: t('stories.cta.practice.secondaryText'),
            visualText: t('stories.cta.practice.visualText'),
            visualGradient: 'from-orb-mint to-orb-sky',
        },
        production: {
            accentColor: 'text-orb-sky',
            accentBg: 'bg-orb-sky',
            icons: (
                <>
                    <Music size={20} />
                    <span className="w-1 h-1 bg-orb-sky rounded-full" />
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-orb-sky rounded-full" />
                    <Settings size={20} />
                </>
            ),
            title: t('stories.cta.production.title'),
            description: (
                <>
                    {t('stories.cta.production.descriptionLine1')}<br className="hidden md:block" />
                    {t('stories.cta.production.descriptionLine2')}
                </>
            ),
            primaryLink: getLink('/contact'),
            primaryText: t('stories.cta.production.primaryText'),
            secondaryLink: getLink('/pricing'),
            secondaryText: t('stories.cta.production.secondaryText'),
            visualText: t('stories.cta.production.visualText'),
            visualGradient: 'from-orb-sky to-orb-lavender',
        }
    };

    const current = content[type];
    const heights = [40, 70, 50, 90, 60, 80, 40, 60];
    const visualRef = useRef<HTMLDivElement>(null);
    const isVisualInView = useInView(visualRef, { amount: 0.35 });
    const ctaMotionProps = createInViewEnterAnimation({ duration: 0.5 });

    return (
        <m.div
            {...ctaMotionProps}
            className="my-16 relative overflow-hidden rounded-card bg-canvas-deep text-white shadow-deep"
        >
            {/* Atmospheric decor orbs */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/[0.03] rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-8">
                <div className="flex-1 text-center md:text-left">
                    <div className={`flex items-center justify-center md:justify-start gap-3 mb-4 ${current.accentColor}`} aria-hidden="true">
                        {current.icons}
                    </div>

                    <h2 className="text-2xl md:text-3xl font-light mb-3 text-on-dark break-words [overflow-wrap:anywhere]">
                        {current.title}
                    </h2>

                    <p className="text-on-dark-soft text-lg leading-relaxed mb-6 break-words [overflow-wrap:anywhere]">
                        {current.description}
                    </p>

                    {/* prefetch={false}: 스토리 본문 끝 CTA. 사용자가 끝까지 스크롤
                        하면 viewport에 들어와 자동 prefetch가 무거운 SSG 데이터를 끌어옴.
                        hover/focus 시 prefetch는 유지. */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                        <Link
                            href={current.primaryLink}
                            prefetch={false}
                            className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-pill bg-white text-ink font-medium hover:bg-on-dark-soft transition-colors shadow-card touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-deep"
                        >
                            <span className="min-w-0">{current.primaryText}</span>
                            <ArrowRight size={18} className="ml-2 flex-shrink-0" aria-hidden="true" />
                        </Link>
                        <Link
                            href={current.secondaryLink}
                            prefetch={false}
                            className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-pill bg-white/10 text-white font-medium hover:bg-white/20 transition-colors border border-white/20 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-deep"
                        >
                            <span className="min-w-0">{current.secondaryText}</span>
                        </Link>
                    </div>
                </div>

                <div className="hidden md:block w-full max-w-xs lg:max-w-sm">
                    <div ref={visualRef} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 p-6 flex flex-col justify-center items-center">
                        <div className="w-full flex justify-between items-end h-32 gap-2 mb-4">
                            {heights.map((h, i) => (
                                <m.div
                                    key={i}
                                    initial={{ height: '20%' }}
                                    animate={isVisualInView ? { height: `${h}%` } : { height: '20%' }}
                                    transition={isVisualInView
                                        ? {
                                            repeat: Infinity,
                                            repeatType: "reverse",
                                            duration: 1.5,
                                            delay: i * 0.1
                                        }
                                        : { duration: 0 }}
                                    className={`flex-1 bg-gradient-to-t ${current.visualGradient} rounded-t-sm opacity-80`}
                                />
                            ))}
                        </div>
                        <p className={`text-sm font-mono ${current.accentColor}`}>{current.visualText}</p>
                    </div>
                </div>
            </div>
        </m.div>
    );
};

export default StoryCTA;
