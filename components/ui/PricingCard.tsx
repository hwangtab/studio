import React from 'react';
import Link from 'next/link';
import { Check } from '@/lib/lucide-icons';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import BaseCard from './BaseCard';
import { Button } from './Button';

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
    /**
     * 1차 CTA(카카오 상담) 아래에 붙는 온라인 예약/주문 보조 CTA.
     * 세 값이 전부 있어야 렌더한다 — 하나라도 빠지면 기존 소비처는 레이아웃 변화 0.
     * 옐로(카카오) 금지: 목적지가 카카오톡이 아니므로 outline 스타일만 쓴다.
     */
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
    onSecondaryCtaClick?: () => void;
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
    secondaryCtaLabel,
    secondaryCtaHref,
    onSecondaryCtaClick,
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
        // 목적지가 카카오가 아니면(비-ko는 /contact 폼) 리드가 아니라 미세 전환으로 센다.
        // 이걸 빼면 비-ko 클릭이 통째로 미집계된다.
        if (!isKakaoCta && trackingComponent) {
            trackMicroEvent('micro_click_contact', {
                locale,
                component: trackingComponent,
                cta_id: `${trackingComponent.toLowerCase()}_${id}_contact`,
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
            // rounded-3xl(24px) 외곽 + 내부 CTA rounded-xl(12px): iOS 26 동심원 라운드
            className="p-8 h-full flex flex-col rounded-3xl"
            delay={delay}
            variant={recommended ? 'glass-highlight' : 'glass'}
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
                /* 카드마다 상품은 달라도 행동은 하나(카톡 문의)라 CTA 색도 하나여야
                   한다. 카카오가 아닌 목적지(폼·상세 페이지)일 때만 primary 유지.
                   카드 안이므로 shape은 block(rounded-xl) — 외곽 rounded-3xl과 동심원. */
                <Button
                    asChild
                    variant={isKakaoCta ? 'kakao' : 'solid'}
                    shape="block"
                    size="md"
                    fullWidth
                >
                    <a
                        href={ctaHref}
                        target={ctaHref.startsWith('http') ? '_blank' : undefined}
                        rel={ctaHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                        onClick={handleCtaClick}
                        className={`mt-6 h-auto min-h-11 py-3 px-4 text-sm ${isKakaoCta ? 'font-bold' : 'font-semibold'}`}
                    >
                        {ctaLabel}
                    </a>
                </Button>
            )}

            {secondaryCtaLabel && secondaryCtaHref && (
                /* outline — 1차(카카오/primary)와 위계가 갈려야 하고, 목적지가
                   카카오톡이 아니므로 옐로는 절대 쓰지 않는다(CLAUDE.md 카카오 배색 규칙).
                   size md(h-11 = 44px)로 터치 타깃 확보. */
                <Button asChild variant="outline" shape="block" size="md" fullWidth>
                    <Link
                        href={secondaryCtaHref}
                        prefetch={false}
                        onClick={onSecondaryCtaClick}
                        className="mt-3 h-auto min-h-11 py-3 px-4 text-sm font-semibold"
                    >
                        {secondaryCtaLabel}
                    </Link>
                </Button>
            )}
        </BaseCard>
    );
};

export default PricingCard;
