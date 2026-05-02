import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { MessageCircle, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../ResponsiveImage';
import SectionHeading from '../ui/SectionHeading';
import { Button } from '../ui/Button';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { trackLeadEvent } from '../../utils/analytics';

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

const CONTACT_CTA_MOTION = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8 },
};

const ContactCTA = ({
    locale,
    title,
    subtitle,
    imageSrc,
    imageAlt,
    primaryButtonLabel,
    secondaryButtonLabel,
    className = "",
    headingAs = 'h2',
}: ContactCTAProps) => {
    const { t } = useTranslation('common', { lng: locale });

    const siteConfig = getSiteConfig(locale);
    const isKorean = locale === 'ko';
    const getLink = (path: string) => `/${locale}${path}`;

    const primaryLabel = primaryButtonLabel ?? t('actions.kakao');
    const secondaryLabel = secondaryButtonLabel ?? t('actions.location');
    const primaryHref = isKorean ? siteConfig.contact.kakaoUrl : getLink('/contact');
    const imageHref = isKorean ? siteConfig.contact.kakaoUrl : getLink('/contact');

    const trackPrimaryCta = React.useCallback(() => {
        trackLeadEvent('lead_click_kakao', {
            locale,
            component: 'ContactCTA',
            cta_id: isKorean ? 'contact_cta_primary_kakao' : 'contact_cta_primary_contact',
        });
    }, [isKorean, locale]);

    const trackImageKakao = React.useCallback(() => {
        if (!isKorean) return;
        trackLeadEvent('lead_click_kakao', {
            locale,
            component: 'ContactCTA',
            cta_id: 'contact_cta_image_kakao',
        });
    }, [isKorean, locale]);

    return (
        <m.div
            className={`bg-canvas-warm dark:bg-surface-dark-elevated rounded-hero border border-hairline overflow-hidden ${className}`}
            {...CONTACT_CTA_MOTION}
        >
            <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
                <div className="p-8 md:p-10 flex flex-col justify-center">
                    <SectionHeading
                        title={title}
                        lead={subtitle}
                        align="left"
                        className="mb-8"
                        as={headingAs}
                    />
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            href={getLink("/contact")}
                            prefetch={false}
                            className="block"
                        >
                            <Button variant="outline" size="lg">
                                {secondaryLabel}
                            </Button>
                        </Link>
                        {isKorean ? (
                            <a
                                href={primaryHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={trackPrimaryCta}
                                className="block"
                            >
                                <Button variant="primary" size="lg">
                                    <MessageCircle className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                                    {primaryLabel}
                                </Button>
                            </a>
                        ) : (
                            <Link
                                href={primaryHref}
                                prefetch={false}
                                onClick={trackPrimaryCta}
                                className="block"
                            >
                                <Button variant="primary" size="lg">
                                    <MessageCircle className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                                    {primaryLabel}
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {isKorean ? (
                    <a
                        href={imageHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={trackImageKakao}
                        aria-label={imageAlt}
                        className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
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
                        <div className="absolute inset-0 bg-gradient-to-r from-canvas-warm/20 to-transparent pointer-events-none" />
                    </a>
                ) : (
                    <Link
                        href={imageHref}
                        prefetch={false}
                        aria-label={imageAlt}
                        className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
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
                        <div className="absolute inset-0 bg-gradient-to-r from-canvas-warm/20 to-transparent pointer-events-none" />
                    </Link>
                )}
            </div>
        </m.div>
    );
};

export default ContactCTA;
