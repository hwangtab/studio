import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Music, Mic2, Settings, BookOpen, GraduationCap, Lightbulb, MapPin, Speaker, Clock } from 'lucide-react';

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
            gradient: 'from-indigo-900 to-purple-900',
            accentColor: 'text-purple-200',
            accentBg: 'bg-purple-200',
            buttonBg: 'bg-white text-indigo-900 hover:bg-purple-50',
            secondaryButtonBg: 'bg-purple-700/50 text-white hover:bg-purple-700/70 border-purple-500/30',
            icons: (
                <>
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-purple-200 rounded-full" />
                    <Settings size={20} />
                    <span className="w-1 h-1 bg-purple-200 rounded-full" />
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
            visualGradient: 'from-purple-500 to-indigo-400',
        },
        lesson: {
            gradient: 'from-orange-800 to-amber-900',
            accentColor: 'text-amber-200',
            accentBg: 'bg-amber-200',
            buttonBg: 'bg-white text-amber-900 hover:bg-amber-50',
            secondaryButtonBg: 'bg-amber-700/50 text-white hover:bg-amber-700/70 border-amber-500/30',
            icons: (
                <>
                    <BookOpen size={20} />
                    <span className="w-1 h-1 bg-amber-200 rounded-full" />
                    <Lightbulb size={20} />
                    <span className="w-1 h-1 bg-amber-200 rounded-full" />
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
            visualGradient: 'from-amber-500 to-orange-400',
        },
        practice: {
            gradient: 'from-emerald-900 to-teal-900',
            accentColor: 'text-emerald-200',
            accentBg: 'bg-emerald-200',
            buttonBg: 'bg-white text-emerald-900 hover:bg-emerald-50',
            secondaryButtonBg: 'bg-teal-700/50 text-white hover:bg-teal-700/70 border-teal-500/30',
            icons: (
                <>
                    <MapPin size={20} />
                    <span className="w-1 h-1 bg-emerald-200 rounded-full" />
                    <Clock size={20} />
                    <span className="w-1 h-1 bg-emerald-200 rounded-full" />
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
            visualGradient: 'from-emerald-500 to-teal-400',
        },
        production: {
            gradient: 'from-blue-900 to-indigo-900',
            accentColor: 'text-blue-200',
            accentBg: 'bg-blue-200',
            buttonBg: 'bg-white text-blue-900 hover:bg-blue-50',
            secondaryButtonBg: 'bg-indigo-700/50 text-white hover:bg-indigo-700/70 border-indigo-500/30',
            icons: (
                <>
                    <Music size={20} />
                    <span className="w-1 h-1 bg-blue-200 rounded-full" />
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-blue-200 rounded-full" />
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
            visualGradient: 'from-blue-500 to-indigo-400',
        }
    };

    const current = content[type];
    const heights = [40, 70, 50, 90, 60, 80, 40, 60];

    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={`my-16 relative overflow-hidden rounded-2xl bg-gradient-to-br ${current.gradient} text-white shadow-xl`}
        >
            {/* Background Decor */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-8">
                <div className="flex-1 text-center md:text-left">
                    <div className={`flex items-center justify-center md:justify-start gap-3 mb-4 ${current.accentColor}`} aria-hidden="true">
                        {current.icons}
                    </div>

                    <h3 className={`text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200 break-words [overflow-wrap:anywhere]`}>
                        {current.title}
                    </h3>

                    <p className="text-white/90 text-lg leading-relaxed mb-6 break-words [overflow-wrap:anywhere]">
                        {current.description}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                        <Link
                            href={current.primaryLink}
                            className={`inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-black/20 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 ${current.buttonBg}`}
                        >
                            <span className="min-w-0">{current.primaryText}</span>
                            <ArrowRight size={18} className="ml-2 flex-shrink-0" aria-hidden="true" />
                        </Link>
                        <Link
                            href={current.secondaryLink}
                            className={`inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-xl font-medium transition-colors backdrop-blur-sm border touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 ${current.secondaryButtonBg}`}
                        >
                            <span className="min-w-0">{current.secondaryText}</span>
                        </Link>
                    </div>
                </div>

                <div className="hidden md:block w-full max-w-xs lg:max-w-sm">
                    {/* Abstract Visual Representation */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 p-6 flex flex-col justify-center items-center">
                        <div className="w-full flex justify-between items-end h-32 gap-2 mb-4">
                            {heights.map((h, i) => (
                                <m.div
                                    key={i}
                                    initial={{ height: '20%' }}
                                    whileInView={{ height: `${h}%` }}
                                    transition={{
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        duration: 1.5,
                                        delay: i * 0.1
                                    }}
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
