import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from '@/lib/lucide-icons';
import { Button } from './ui/Button';
import { STORY_CTA, STORY_CTA_SECONDARY_PATH, type CTAType } from '../lib/storyCta';
import { trackMicroEvent } from '../utils/analytics';

import type { Locale } from '../lib/i18n';

export type { CTAType };

interface StoryCTAProps {
    type?: CTAType;
    locale?: Locale;
}

/**
 * 스토리 본문 끝 CTA — 유형이 무엇이든 **모양은 하나**다(docs/design-system.md §4 "스토리 CTA").
 * 유형별 내용(아이콘·목적지·가격 보간)은 lib/storyCta.ts, 문구는 `stories.cta.<type>.*`.
 *
 * 회색 면 카드 + 잉크 제목(아이콘 줄 없음 — TDS: 아이콘을 나란히 늘어놓지 않는다) + 파랑 주 버튼(서비스 LP) + 연한 파랑 보조 버튼(/contact). 그라디언트·흐림·무한 반복
 * 막대 애니메이션은 2026-10-09에 걷었다 — 파랑 = 누를 수 있는 것, 장식 모션 없음(TDS 대조). 색을 유형마다 다시
 * 주고 싶어지면 storyCtaDesign.test.ts가 막는다.
 */
const StoryCTA: React.FC<StoryCTAProps> = ({ type = 'recording', locale = 'ko' }) => {
    const { t } = useTranslation('common', { lng: locale });
    const spec = STORY_CTA[type];
    const primaryLink = `/${locale}${spec.primaryPath}`;
    const secondaryLink = `/${locale}${STORY_CTA_SECONDARY_PATH}`;

    // CTA 클릭 추적. StoryCTA 버튼은 전부 내부 페이지 이동이므로 리드가 아니라 마이크로 전환이다 — lead_*로
    // 발화하면 "이동을 리드로 집계하는" 오염이 재발한다(2026-07-14 수정 참조). cta_id는 유형·순서로 고정이다.
    const trackCtaClick = (variant: 'primary' | 'secondary', target: string) => {
        const isContact = target.endsWith('/contact');
        trackMicroEvent(isContact ? 'micro_click_contact' : 'micro_click_service', {
            locale,
            component: 'StoryCTA',
            cta_id: `story_cta_${type}_${variant}`,
            cta_type: type,
            cta_variant: variant,
            cta_target: target,
        });
    };

    return (
        <aside className="my-16 rounded-2xl border border-gray-200 bg-paper-2 p-8 md:p-10 dark:border-gray-800 dark:bg-gray-900">

            <h2 className="font-title text-2xl md:text-3xl font-bold leading-snug text-gray-950 dark:text-white mb-3 break-words [overflow-wrap:anywhere]">
                {t(`stories.cta.${type}.title`)}
            </h2>

            <p className="typo-body text-gray-700 dark:text-gray-300 mb-6 break-words [overflow-wrap:anywhere]">
                <span className="block">{t(`stories.cta.${type}.descriptionLine1`, spec.descriptionLine1Params?.(locale))}</span>
                <span className="block">{t(`stories.cta.${type}.descriptionLine2`)}</span>
            </p>

            {/* prefetch={false}: 스토리 본문 끝 CTA. 끝까지 스크롤하면 viewport에 들어와 자동 prefetch가 무거운
                SSG 데이터를 끌어온다. hover/focus 시 prefetch는 유지. */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild variant="solid" shape="block" size="lg">
                    <Link href={primaryLink} prefetch={false} onClick={() => trackCtaClick('primary', primaryLink)} className="whitespace-normal text-center leading-snug">
                        <span className="min-w-0">{t(`stories.cta.${type}.primaryText`)}</span>
                        <ArrowRight size={18} className="flex-shrink-0" aria-hidden="true" />
                    </Link>
                </Button>
                <Button asChild variant="weak" shape="block" size="lg">
                    <Link href={secondaryLink} prefetch={false} onClick={() => trackCtaClick('secondary', secondaryLink)} className="whitespace-normal text-center leading-snug">
                        <span className="min-w-0">{t(`stories.cta.${type}.secondaryText`)}</span>
                    </Link>
                </Button>
            </div>
        </aside>
    );
};

export default StoryCTA;
