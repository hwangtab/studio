import { cn } from '../../lib/utils';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { FADE_IN_UP, HOVER_Y, SHADOW_HOVER } from '../../utils/animationUtils';

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
    variant?: 'default' | 'highlight' | 'outline';
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
    const baseStyles = "relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden";

    const variants = {
        default: "shadow-md border border-gray-100 dark:border-gray-700",
        highlight: "shadow-lg border border-primary/20 dark:border-primary-light/20 ring-1 ring-primary/10 dark:ring-primary-light/10",
        outline: "border border-gray-200 dark:border-gray-700 bg-transparent",
    };

    const animationProps = {
        ...FADE_IN_UP,
        whileHover: hoverEffect ? { ...HOVER_Y, ...SHADOW_HOVER } : {},
        transition: { ...FADE_IN_UP.transition, delay }
    };

    const isInteractive = Boolean(onClick || href);
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
            {...animationProps}
        >
            {children}
        </m.div>
    );
});

BaseCard.displayName = 'BaseCard';

export default BaseCard;
