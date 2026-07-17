import React from 'react';
import { Check } from '@/lib/lucide-icons';
import { trackLeadEvent } from '../../utils/analytics';
import BaseCard from './BaseCard';

interface PricingCardProps {
    id: string;
    title: string;
    price: string;
    unit?: string;
    description: string;
    features: string[];
    recommended?: boolean;
    delay?: number;
    ctaLabel?: string;
    ctaHref?: string;
    /**
     * 명시적 클릭 핸들러. 넘기면 카드는 이 핸들러만 호출하고 자동 추적을 하지 않는다
     * (호출자가 계측 책임을 가짐 — wedding/voice/cover 페이지 패턴).
     */
    onCtaClick?: () => void;
    /**
     * 자동 카카오 리드 추적용 컨텍스트. `onCtaClick` 없이 카카오 CTA를 렌더할 때
     * 이 두 값을 넘기면 카드가 `lead_click_kakao`를 알아서 발화한다.
     * 가격 페이지처럼 카드를 map으로 대량 렌더하는 곳의 추적 누락을 구조적으로 막는다.
     */
    trackingComponent?: string;
    locale?: string;
}

const PricingCard = ({
    id,
    title,
    price,
    unit,
    description,
    features,
    recommended,
    delay,
    ctaLabel,
    ctaHref,
    onCtaClick,
    trackingComponent,
    locale,
}: PricingCardProps) => {
    const isKakaoCta = Boolean(ctaHref && ctaHref.includes('kakao'));

    const handleCtaClick = () => {
        // 호출자가 직접 핸들러를 넘긴 경우 그것만 실행 — 이중 발화 방지.
        if (onCtaClick) {
            onCtaClick();
            return;
        }
        // 카카오 CTA인데 추적 컨텍스트가 있으면 자동으로 리드 발화.
        if (isKakaoCta && trackingComponent) {
            trackLeadEvent('lead_click_kakao', {
                locale,
                component: trackingComponent,
                cta_id: `${trackingComponent.toLowerCase()}_${id}_kakao`,
            });
            return;
        }
        // 카카오 CTA인데 아무 추적 경로도 없으면 개발 중에 시끄럽게 경고 —
        // 가격 페이지에서 실제로 발생했던 "리드 무집계" 회귀를 재발 즉시 잡는다.
        if (
            process.env.NODE_ENV !== 'production' &&
            isKakaoCta &&
            !trackingComponent
        ) {
            // eslint-disable-next-line no-console
            console.warn(
                `[PricingCard] 카카오 CTA("${id}")가 추적되지 않습니다 — onCtaClick 또는 trackingComponent를 넘기세요.`
            );
        }
    };

    return (
        <BaseCard
            className="p-8 h-full flex flex-col"
            delay={delay}
            variant={recommended ? 'highlight' : 'default'}
            hoverEffect={true}
        >
            {recommended && (
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                    RECOMMENDED
                </div>
            )}
            <h3 className="typo-card-title mb-2">{title}</h3>
            <div className="flex items-baseline mb-4">
                <span className="text-3xl font-extrabold text-primary dark:text-primary-light">{price}</span>
                {unit && <span className="text-gray-500 dark:text-gray-400 ml-1 text-sm">{unit}</span>}
            </div>
            <p className="typo-card-body mb-6">{description}</p>

            <div className="border-t border-gray-100 dark:border-gray-700 my-4"></div>

            <ul className="space-y-3 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <Check className="text-green-500 mt-1 mr-2 flex-shrink-0" size={14} aria-hidden="true" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {ctaLabel && ctaHref && (
                <a
                    href={ctaHref}
                    target={ctaHref.startsWith('http') ? '_blank' : undefined}
                    rel={ctaHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                    onClick={handleCtaClick}
                    className="mt-6 block w-full text-center py-3 px-4 rounded-lg font-semibold text-sm transition-colors bg-primary hover:bg-primary-dark text-white"
                >
                    {ctaLabel}
                </a>
            )}
        </BaseCard>
    );
};

export default PricingCard;
