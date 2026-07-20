import { cn } from '../../lib/utils';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { FADE_IN_UP, CARD_HOVER, SHADOW_HOVER, EASE_STANDARD } from '../../utils/animationUtils';

// 신 Link API(자체 <a> 렌더)에 framer-motion을 결합한 컴포넌트. legacyBehavior +
// 자식 <m.a> 조합(차기 Next에서 제거 예정)을 대체하며, 렌더 결과는 동일한 단일 <a>.
// 모듈 스코프에서 1회 생성(렌더마다 재생성 방지). LazyMotion(domAnimation) 컨텍스트
// 하에서 whileHover 등 제스처 동작 — 기존 m.a와 동일한 피처만 요구.
const MotionLink = m.create(Link);

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

    // glass 카드의 box-shadow는 inset 스펙큘러 라인을 포함하므로 SHADOW_HOVER
    // (inline boxShadow 애니메이션)를 섞으면 hover 순간 스펙큘러가 사라진다.
    // glass는 리프트만 — iOS 재질 감각에도 그림자 팽창 없는 쪽이 맞다.
    const isGlass = variant !== 'outline';

    const isInteractive = Boolean(onClick || href);

    const animationProps = {
        ...FADE_IN_UP,
        // whileHover에 CARD_HOVER(= HOVER_Y + TRANSITION_STANDARD)를 써서 hover 리프트가
        // 자체 transition을 갖게 한다. 이렇게 안 하면 whileHover가 아래 컴포넌트 레벨
        // transition(진입 delay 포함)을 상속해, delay 큰 카드일수록 hover 리프트가 늦게
        // 시작한다. y·shadow 값은 기존(HOVER_Y+SHADOW_HOVER)과 동일하게 유지.
        whileHover: hoverEffect ? (isGlass ? { ...CARD_HOVER } : { ...CARD_HOVER, ...SHADOW_HOVER }) : {},
        // press 피드백은 클릭 가능한 카드에만. transition을 자체 보유해야 진입 delay를
        // 상속하지 않는 것은 whileHover와 동일한 이유.
        whileTap: isInteractive && hoverEffect
            ? { scale: 0.98, transition: { duration: 0.1, ease: EASE_STANDARD } }
            : undefined,
        transition: { ...FADE_IN_UP.transition, delay }
    };

    // 스펙큘러 하이라이트(globals.css의 .glass-card::after)에 포인터 좌표 주입.
    // 커스텀 프로퍼티만 갱신하므로 layout을 더럽히지 않는다(리플로우 无).
    const specularHandlers = isGlass && hoverEffect
        ? {
            onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
            },
        }
        : {};
    const interactiveStyles = isInteractive
        ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        : "";
    const cardClassName = cn(baseStyles, variants[variant], interactiveStyles, className);
    const isExternal = Boolean(href && /^(https?:|mailto:|tel:)/.test(href));

    if (href) {
        const resolvedRel = target === '_blank' ? (rel ?? 'noopener noreferrer nofollow') : rel;
        const anchorProps = {
            className: cardClassName,
            onClick,
            target,
            rel: resolvedRel,
        };

        if (isExternal) {
            return (
                <m.a href={href} {...animationProps} {...anchorProps} {...specularHandlers}>
                    {children}
                </m.a>
            );
        }

        return (
            // prefetch={false}: BaseCard는 FeatureCard·PricingCard·ReviewSection·
            // QuickAnswers의 wrapper로 listing 형태로 다수 인스턴스가 viewport에
            // 동시 등장. 기본 prefetch면 카드 수만큼 SSG JSON·청크가 동시 다운로드.
            // hover/focus 시 prefetch는 next/link 휴리스틱으로 유지.
            <MotionLink href={href} prefetch={false} {...animationProps} {...anchorProps} {...specularHandlers}>
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
                {...specularHandlers}
                onClick={onClick}
            >
                {children}
            </m.button>
        );
    }

    return (
        <m.div
            className={cardClassName}
            {...animationProps}
            {...specularHandlers}
        >
            {children}
        </m.div>
    );
});

BaseCard.displayName = 'BaseCard';

export default BaseCard;
