import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Mail, MessageCircle, Sparkles } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../ResponsiveImage';
import SectionHeading from '../ui/SectionHeading';
import type { Locale } from '../../lib/i18n';
import type { LucideIcon } from '@/lib/lucide-icons';
import { getSiteConfig } from '../../data/siteConfig';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

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


    const siteConfig = getSiteConfig(locale);
    const isKorean = locale === 'ko';
    const getLink = (path: string) => `/${locale}${path}`;

    // 비한국어에서는 primary가 카카오톡이 아니라 문의 폼이다. 라벨·아이콘·이벤트를 모두 그에 맞춘다.
    const primaryLabel = primaryButtonLabel ?? (isKorean ? t('actions.kakao') : t('actions.contact'));
    const secondaryLabel = secondaryButtonLabel ?? t('actions.location');
    const contactHref = getLink('/contact');
    const primaryHref = isKorean ? siteConfig.contact.kakaoUrl : contactHref;
    const imageHref = isKorean ? siteConfig.contact.kakaoUrl : contactHref;

    const trackPrimaryCta = React.useCallback(() => {
        // 목적지가 카카오톡일 때만 카톡 리드다. 비한국어는 /contact로 가므로 별개 이벤트.
        if (isKorean) {
            trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'ContactCTA',
                cta_id: 'contact_cta_primary_kakao',
            });
            return;
        }
        trackMicroEvent('micro_click_contact', {
            locale,
            component: 'ContactCTA',
            cta_id: 'contact_cta_primary_contact',
        });
    }, [isKorean, locale]);

    const trackSecondaryContact = React.useCallback(() => {
        trackMicroEvent('micro_click_contact', {
            locale,
            component: 'ContactCTA',
            cta_id: 'contact_cta_secondary_contact',
        });
    }, [locale]);

    const trackImageCta = React.useCallback(() => {
        if (isKorean) {
            trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'ContactCTA',
                cta_id: 'contact_cta_image_kakao',
            });
            return;
        }
        trackMicroEvent('micro_click_contact', {
            locale,
            component: 'ContactCTA',
            cta_id: 'contact_cta_image_contact',
        });
    }, [isKorean, locale]);

    const contactCtaMotionProps = {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: { once: true },
        transition: { duration: 0.8 }
    };

    return (
        <m.div
            className={`overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 ${className}`}
            {...contactCtaMotionProps}
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
                        {isKorean && (
                            <Link
                                href={contactHref}
                                prefetch={false}
                                onClick={trackSecondaryContact}
                                className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-colors transition-shadow duration-300 border border-gray-100 dark:border-gray-600 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                            >
                                <span className="min-w-0">{secondaryLabel}</span>
                            </Link>
                        )}
                        {isKorean ? (
                            <a
                                href={primaryHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={trackPrimaryCta}
                                /* 목적지가 카카오톡일 때만 옐로. 비-ko는 /contact 폼으로 가므로
                                   아래 Link가 primary 보라를 유지한다(노란 버튼 = 카카오톡 규칙). */
                                className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-kakao hover:bg-kakao-dark text-kakao-ink font-bold py-4 px-8 rounded-2xl shadow-xl transition-colors transition-shadow duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                            >
                                <MessageCircle className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                                <span className="min-w-0">{primaryLabel}</span>
                            </a>
                        ) : (
                            <Link
                                href={primaryHref}
                                prefetch={false}
                                onClick={trackPrimaryCta}
                                className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-colors transition-shadow duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
                            >
                                <Mail className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                                <span className="min-w-0">{primaryLabel}</span>
                            </Link>
                        )}
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        {t('actions.responseAssurance', { defaultValue: '보통 24시간 이내 답변 · 당일 예약도 가능합니다' })}
                    </p>
                </div>

                {isKorean ? (
                    <a
                        href={imageHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={trackImageCta}
                        aria-label={imageAlt}
                        className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                    >
                        <ResponsiveImage
                            src={imageSrc}
                            alt={imageAlt}
                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
                            pictureClassName="block h-full"
                            loading="lazy"
                            sizes="(min-width: 768px) 50vw, 100vw"
                            fill
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                    </a>
                ) : (
                    <Link
                        href={imageHref}
                        prefetch={false}
                        onClick={trackImageCta}
                        aria-label={imageAlt}
                        className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                    >
                        <ResponsiveImage
                            src={imageSrc}
                            alt={imageAlt}
                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
                            pictureClassName="block h-full"
                            loading="lazy"
                            sizes="(min-width: 768px) 50vw, 100vw"
                            fill
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                    </Link>
                )}
            </div>
        </m.div>
    );
};

export default ContactCTA;
