import { cn } from '../../lib/utils';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { FADE_IN_UP } from '../../utils/animationUtils';

// 신 Link API(자체 <a> 렌더)에 framer-motion을 결합한 컴포넌트. legacyBehavior +
// 자식 <m.a> 조합(차기 Next에서 제거 예정)을 대체하며, 렌더 결과는 동일한 단일 <a>.
// 모듈 스코프에서 1회 생성(렌더마다 재생성 방지). LazyMotion(domAnimation) 컨텍스트
// 하에서 whileHover 등 제스처 동작 — 기존 m.a와 동일한 피처만 요구.
const MotionLink = m.create(Link);


/**
 * 카드 패딩 세 단(docs/design-system.md §3). 소비처가 className에 `p-5`·`p-7`을 따로 적던
 * 것을 이 표 하나로 모은다 — Panel의 `PANEL_PADDING`과 같은 값이다. `none`은 이미지가
 * 가장자리까지 닿는 카드(썸네일 위·본문 아래)처럼 안쪽 래퍼가 패딩을 직접 갖는 경우다.
 * 그 래퍼도 손으로 적지 말고 이 표를 참조할 것(`CARD_PADDING.default`).
 */
export type BaseCardPadding = 'none' | 'compact' | 'default' | 'roomy';
export const CARD_PADDING: Record<BaseCardPadding, string> = {
    none: '',
    compact: 'p-4',
    default: 'p-6',
    roomy: 'p-6 sm:p-8',
};

interface BaseCardProps {
    children: React.ReactNode;
    className?: string;
    href?: string;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    target?: string;
    rel?: string;
    delay?: number;
    variant?: 'default' | 'highlight' | 'outline' | 'glass' | 'glass-highlight';
    hoverEffect?: boolean;
    /** 기본 `none` — 기존 소비처의 className 패딩을 조용히 바꾸지 않기 위해서다. */
    padding?: BaseCardPadding;
}

const BaseCard = React.memo(({
    children,
    className = '',
    href,
    onClick,
    target,
    rel,
    delay = 0,
    variant = 'default',
    hoverEffect = true,
    padding = 'none',
}: BaseCardProps) => {
    // bg는 baseStyles가 아닌 variant가 소유한다 — glass variant의 배경은
    // .glass-card(components 레이어)가 제공하는데, baseStyles에 bg-* 유틸리티가
    // 있으면 utilities 레이어가 재질 배경을 덮어써 솔리드 폴백까지 깨진다.
    const baseStyles = "relative rounded-xl overflow-hidden";

    const variants = {
        // Phase 4: 기본 카드 재질을 글래스로 전환. .glass-card는 backdrop-filter가
        // 없어 전 소비처 일괄 전환의 성능 비용이 0이다. glass/glass-highlight는
        // Phase 3 명시 사용처를 위한 동의어. 솔리드가 꼭 필요한 곳은 outline +
        // className으로 개별 처리한다.
        default: "glass-card",
        highlight: "glass-card ring-1 ring-primary/20 dark:ring-primary-light/20",
        outline: "border border-gray-200 dark:border-gray-700 bg-transparent",
        glass: "glass-card",
        'glass-highlight': "glass-card ring-1 ring-primary/20 dark:ring-primary-light/20",
    };

    const isInteractive = Boolean(onClick || href);
    // 누를 수 있는 카드만 hover에 반응한다. 누를 수 없는 카드가 떠오르면 "카드를 누르라"는 거짓 신호가 되고,
    // 안에 버튼이 있으면 카드와 버튼이 함께 움직여 어지럽다(운영자 2026-10-08 — 가격 카드).
    const respondsToHover = hoverEffect && isInteractive;

    const animationProps = {
        ...FADE_IN_UP,
        // 카드는 떠오르지 않는다(2026-10-09 TDS 대조 — 목록 행은 누르면 살짝 어두워질 뿐 들리지 않는다). 반응은 아래
        // interactiveStyles의 CSS(filter)가 맡는다: hover 살짝 어둡게, 누르면 조금 더.
        transition: { ...FADE_IN_UP.transition, delay }
    };

    // 링크 카드 반응 — hover 살짝 어둡게(마우스 기기만), 누르면 조금 더. transform이 아니라 filter라 떠오르지 않는다.
    const interactiveStyles = isInteractive
        ? `cursor-pointer transition-[filter] duration-fast ${respondsToHover ? 'hover:brightness-[0.98] active:brightness-95' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`
        : "";
    // className이 뒤에 와서 호출부의 `pt-8` 같은 개별 조정이 이긴다(twMerge).
    const cardClassName = cn(baseStyles, variants[variant], CARD_PADDING[padding], interactiveStyles, className);
    const isExternal = Boolean(href && /^(https?:|mailto:|tel:)/.test(href));

    if (href) {
        const resolvedRel = target === '_blank' ? (rel ?? 'noopener noreferrer nofollow') : rel;
        // target="_blank"는 클릭하는 순간 새 탭이 포인터를 가져가 원래 탭에 pointerleave가
        // 오지 않는다 — whileHover 리프트(-4px)가 클릭 뒤에도 얼어붙은 채 남는다(2026-09-30
        // 실측: about.tsx 카카오톡·네이버 지도 카드, 목자르기 출연진 카드에서 재현. `:hover`
        // matches true, transform: translateY(-4px) 그대로). Framer의 호버 제스처는
        // pointerleave를 노드에서 직접 구독하므로, 합성 이벤트로 같은 신호를 보내 리프트만
        // 즉시 되돌린다 — 스펙큘러 글로우는 CSS `:hover` 구동이라 실제 마우스가 움직여야
        // 꺼지지만, 카드가 계속 들려 있는 것보다는 훨씬 덜 눈에 띈다.
        const handleBlankTargetClick = (e: React.MouseEvent<HTMLElement>) => {
            onClick?.(e);
            const node = e.currentTarget;
            requestAnimationFrame(() => {
                node.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
            });
        };
        const anchorProps = {
            className: cardClassName,
            onClick: target === '_blank' ? handleBlankTargetClick : onClick,
            target,
            rel: resolvedRel,
        };

        if (isExternal) {
            return (
                <m.a href={href} {...animationProps} {...anchorProps}>
                    {children}
                </m.a>
            );
        }

        return (
            // prefetch={false}: BaseCard는 FeatureCard·PricingCard·ReviewSection·
            // QuickAnswers의 wrapper로 listing 형태로 다수 인스턴스가 viewport에
            // 동시 등장. 기본 prefetch면 카드 수만큼 SSG JSON·청크가 동시 다운로드.
            // hover/focus 시 prefetch는 next/link 휴리스틱으로 유지.
            <MotionLink href={href} prefetch={false} {...animationProps} {...anchorProps}>
                {children}
            </MotionLink>
        );
    }

    if (onClick) {
        return (
            <m.button
                type="button"
                className={cardClassName}
                {...animationProps}
               
                onClick={onClick}
            >
                {children}
            </m.button>
        );
    }

    return (
        <m.div
            className={cardClassName}
            data-card-static=""
            {...animationProps}
           
        >
            {children}
        </m.div>
    );
});

BaseCard.displayName = 'BaseCard';

export default BaseCard;
