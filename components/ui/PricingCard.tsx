import React from 'react';
import Link from 'next/link';
import { Check } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import BaseCard from './BaseCard';
import { Badge } from './Badge';
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
    /**
     * 카카오 CTA의 무게(라이너 노트 §3-4, docs/design-liner-notes-plan-2026-10.md).
     * - 'solid'(기본): 지금처럼 카드 안에 솔리드 옐로 블록 — 카드가 혼자 있는 자리.
     * - 'band': 카드 안에는 카카오 CTA를 **그리지 않고** 행 아래 `KakaoSectionBar` 하나로 모은다. 그러면
     *   온라인 주문·예약(secondaryCta)이 카드의 1차 블록 버튼(브랜드색)으로 올라온다. 한 행에 노랑이 셋이던
     *   것을 하나로 — 노랑은 한 화면에 하나. 카카오 목적지 링크를 잉크 텍스트로 "조용히" 그리는 안은
     *   ctaButtonContract(카카오 목적지 = bg-kakao)에 막혀 쓰지 않는다. 비-ko(/contact 목적지)는 영향 없다.
     */
    kakaoEmphasis?: 'solid' | 'band';
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
    kakaoEmphasis = 'solid',
}: PricingCardProps) => {
    const { t } = useTranslation('common', { lng: locale });
    const isKakaoCta = Boolean(ctaHref && ctaHref.includes('kakao'));
    // band 모드에서는 카카오 CTA를 행 아래 띠에 넘긴다. 카카오가 아닌 목적지(비-ko /contact)는 그대로 카드 안.
    const kakaoInBand = kakaoEmphasis === 'band' && isKakaoCta;

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
            // rounded-3xl(24px) 외곽 + 내부 CTA rounded-xl(12px): iOS 26 동심원 라운드.
            // 라이너 노트 §3-4: 종이 바탕 위 흰 카드 + 괘선, 그림자 없음. 추천 카드만 브랜드색 테두리 + ring-1
            // (design-system §3 "강조는 border-primary + ring-1 ring-primary/30").
            className={`p-8 h-full flex flex-col rounded-3xl bg-white dark:bg-gray-800/40 ${
                recommended ? 'border-primary ring-1 ring-primary/30 dark:border-primary-lighter dark:ring-primary-lighter/30' : ''
            }`}
            delay={delay}
            variant="outline"
            hoverEffect={true}
        >
            {recommended && (
                /* 추천 리본은 공용 Badge(brand)다 — 손으로 짠 모서리 리본(rounded-bl/tr-lg)은 반경 네 단
                   어디에도 없었다(§3). 카드 패딩(p-8) 안쪽 모서리에 맞춰 absolute로 둔다. */
                <Badge tone="brand" size="md" className="absolute top-4 right-4">
                    {t('actions.popularBadge', { defaultValue: '가장 많이 고르는' })}
                </Badge>
            )}
            <h3 className="typo-card-title mb-2">{title}</h3>
            <div className="flex items-baseline mb-4">
                <span className="text-3xl font-extrabold text-gray-950 dark:text-white">{price}</span>
                {unit && <span className="text-gray-500 dark:text-gray-400 ml-1 text-sm">{unit}</span>}
            </div>
            <p className="typo-card-body mb-6">{description}</p>

            <div className="border-t border-gray-100 dark:border-gray-700 my-4"></div>

            <ul className="space-y-3 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <Check className="text-primary dark:text-primary-lighter mt-1 mr-2 flex-shrink-0" size={14} aria-hidden="true" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {ctaLabel && ctaHref && !kakaoInBand && (
                /* 카드마다 상품은 달라도 행동은 하나(카톡 문의)라 CTA 색도 하나여야
                   한다. 카카오가 아닌 목적지(폼·상세 페이지)일 때만 primary 유지.
                   카드 안이므로 shape은 block(rounded-xl) — 외곽 rounded-3xl과 동심원.
                   band 모드(kakaoInBand)에서는 이 버튼이 빠지고 행 아래 KakaoSectionBar가 맡는다. */
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
                <Button asChild variant={kakaoInBand ? 'solid' : 'weak'} shape="block" size="md" fullWidth>
                    <Link
                        href={secondaryCtaHref}
                        prefetch={false}
                        onClick={onSecondaryCtaClick}
                        // band 모드에서는 온라인 주문·예약이 카드의 1차 버튼이다(브랜드색 solid, mt-6).
                        className={`${kakaoInBand ? 'mt-6' : 'mt-3'} h-auto min-h-11 py-3 px-4 text-sm font-semibold`}
                    >
                        {secondaryCtaLabel}
                    </Link>
                </Button>
            )}
        </BaseCard>
    );
};

export default PricingCard;
