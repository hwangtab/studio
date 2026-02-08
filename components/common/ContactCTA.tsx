import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { MessageCircle, Sparkles, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../ResponsiveImage';
import SectionHeading from '../ui/SectionHeading';
import type { Locale } from '../../lib/i18n';

interface ContactCTAProps {
    locale: Locale;
    title: React.ReactNode;
    subtitle: React.ReactNode;
    imageSrc: string;
    imageAlt: string;
    primaryButtonLabel?: string;
    secondaryButtonLabel?: string;
    icon?: LucideIcon;
    className?: string;
    headingAs?: 'h2' | 'h3';
}

const ContactCTA = ({
    locale,
    title,
    subtitle,
    imageSrc,
    imageAlt,
    primaryButtonLabel,
    secondaryButtonLabel,
    icon: Icon = Sparkles,
    className = "",
    headingAs = 'h2',
}: ContactCTAProps) => {
    const { t } = useTranslation('common', { lng: locale });
    const getLink = (path: string) => `/${locale}${path}`;

    const primaryLabel = primaryButtonLabel ?? t('actions.kakao');
    const secondaryLabel = secondaryButtonLabel ?? t('actions.location');

    return (
        <m.div
            className={`overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 ${className}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
        >
            <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
                <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
                    <SectionHeading
                        icon={Icon}
                        title={title}
                        subtitle={subtitle}
                        align="left"
                        className="mb-8"
                        as={headingAs}
                    />
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            href={getLink("/contact")}
                            className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-colors transition-shadow duration-300 border border-gray-100 dark:border-gray-600 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                        >
                            <span className="min-w-0">{secondaryLabel}</span>
                        </Link>
                        <a
                            href="https://open.kakao.com/me/nol"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-colors transition-shadow duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
                        >
                            <MessageCircle className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                            <span className="min-w-0">{primaryLabel}</span>
                        </a>
                    </div>
                </div>

                <a
                    href="https://open.kakao.com/me/nol"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
                >
                    <ResponsiveImage
                        src={imageSrc}
                        alt={imageAlt}
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        pictureClassName="block h-full"
                        loading="lazy"
                        sizes="(min-width: 768px) 50vw, 100vw"
                        fill
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                </a>
            </div>
        </m.div>
    );
};

export default ContactCTA;
