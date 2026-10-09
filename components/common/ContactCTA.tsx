import React from 'react';
import Link from 'next/link';
import { Mail, MessageCircle, Sparkles } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../ResponsiveImage';
import SectionHeading from '../ui/SectionHeading';
import type { Locale } from '../../lib/i18n';
import type { LucideIcon } from '@/lib/lucide-icons';
import { getSiteConfig } from '../../data/siteConfig';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { useReportKakaoBlock } from './kakaoBlockVisibility';

interface ContactCTAProps {
    locale: Locale;
    title: React.ReactNode;
    subtitle: React.ReactNode;
    imageSrc: string;
    imageAlt: string;
    primaryButtonLabel?: string;
    secondaryButtonLabel?: string;
    /**
     * 보조 버튼 목적지(로케일 접두 없이). 기본은 문의 페이지의 지도·주소 카드(`/contact#location`) — 기본 글자가
     * "위치"·"오시는 길"이라 글자와 도착지가 같아야 한다(TDS: 글자만 보고 결과를 예측할 수 있어야 한다, 2026-10-09).
     * 글자를 "문의하기"·"가격"처럼 다르게 주면 목적지도 함께 넘긴다.
     */
    secondaryHref?: string;
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
    secondaryHref = '/contact#location',
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
    // 한국어는 이 블록의 주 버튼이 카톡이다 — 보이는 동안 떠 있는 카톡 버튼들을 숨긴다(한 화면에 카톡 버튼 하나).
    const rootRef = React.useRef<HTMLDivElement>(null);
    useReportKakaoBlock(rootRef, isKorean);
    const secondaryLink = getLink(secondaryHref);
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
            cta_target: secondaryLink,
        });
    }, [locale, secondaryLink]);

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

    // variant가 표현하지 못하는 레이아웃(전폭·가변 높이·긴 라벨 줄바꿈)만 남긴다.
    const ctaLayout = 'w-full sm:w-auto h-auto min-h-[44px] py-4 px-8 text-center break-all sm:break-normal whitespace-normal leading-snug font-bold touch-manipulation';

    return (
        // 스크롤 등장(opacity 0 → 1)과 파랑 틴트 면은 2026-10-09에 걷었다 — 장식 모션 없음, 파랑 = 누를 수 있는 것.
        // SSR HTML이 opacity:0으로 칠해져 하이드레이션 전엔 보이지 않던 것도 함께 사라진다.
        <div ref={rootRef} className={`overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 ${className}`}>
            <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
                <div className="bg-paper-2 dark:bg-gray-900 p-8 md:p-12 flex flex-col justify-center">
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
                            <Button asChild variant="secondary" shape="pill" size="lg">
                                <Link
                                    href={secondaryLink}
                                    prefetch={false}
                                    onClick={trackSecondaryContact}
                                    className={ctaLayout}
                                >
                                    <span className="min-w-0">{secondaryLabel}</span>
                                </Link>
                            </Button>
                        )}
                        {isKorean ? (
                            /* 목적지가 카카오톡일 때만 옐로. 비-ko는 /contact 폼으로 가므로
                               아래 Link가 primary 보라를 유지한다(노란 버튼 = 카카오톡 규칙). */
                            <Button asChild variant="kakao" shape="pill" size="lg">
                                <a
                                    href={primaryHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={trackPrimaryCta}
                                    className={ctaLayout}
                                >
                                    <MessageCircle className="flex-shrink-0" size={20} aria-hidden="true" />
                                    <span className="min-w-0">{primaryLabel}</span>
                                </a>
                            </Button>
                        ) : (
                            <Button asChild variant="solid" shape="pill" size="lg">
                                <Link
                                    href={primaryHref}
                                    prefetch={false}
                                    onClick={trackPrimaryCta}
                                    className={ctaLayout}
                                >
                                    <Mail className="flex-shrink-0" size={20} aria-hidden="true" />
                                    <span className="min-w-0">{primaryLabel}</span>
                                </Link>
                            </Button>
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
                        className="relative h-64 md:h-auto overflow-hidden block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                    >
                        <ResponsiveImage
                            src={imageSrc}
                            alt={imageAlt}
                            className="w-full h-full object-cover"
                            pictureClassName="block h-full"
                            loading="lazy"
                            sizes="(min-width: 768px) 50vw, 100vw"
                            fill
                        />
                    </a>
                ) : (
                    <Link
                        href={imageHref}
                        prefetch={false}
                        onClick={trackImageCta}
                        aria-label={imageAlt}
                        className="relative h-64 md:h-auto overflow-hidden block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                    >
                        <ResponsiveImage
                            src={imageSrc}
                            alt={imageAlt}
                            className="w-full h-full object-cover"
                            pictureClassName="block h-full"
                            loading="lazy"
                            sizes="(min-width: 768px) 50vw, 100vw"
                            fill
                        />
                    </Link>
                )}
            </div>
        </div>
    );
};

export default ContactCTA;
