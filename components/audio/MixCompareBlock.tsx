import React from 'react';
import MixComparePlayer from './MixComparePlayer';
import { getMixCompareCopy } from '../../data/mixCompare';
import type { Locale } from '../../lib/i18n';

interface MixCompareBlockProps {
  locale: Locale;
  /** 계측 component 값 — 예: 'ReleaseMixCompare'. */
  component: string;
  className?: string;
}

/**
 * 페이지 안의 하위 블록으로 붙는 30초 발췌 비교 — 소제목 + 플레이어.
 * 절(Section)이 아니다: 절을 끼우면 아래 모든 절의 배경 번갈음이 뒤집히므로, 이미 있는 절 안에 넣는다.
 * 홈은 전체 곡을 자기 절로 쓴다(MixComparePlayer를 직접).
 */
export default function MixCompareBlock({ locale, component, className }: MixCompareBlockProps) {
  const copy = React.useMemo(() => getMixCompareCopy(locale, 'excerpt'), [locale]);
  return (
    <div className={className ?? 'mt-14 max-w-3xl mx-auto border-t border-gray-200 dark:border-gray-800 pt-10'}>
      <h3 className="font-title text-2xl md:text-3xl font-bold leading-snug text-gray-950 dark:text-white mb-6 break-keep">
        {copy.excerptTitle}
      </h3>
      <MixComparePlayer locale={locale} copy={copy} portfolioHref={`/${locale}/portfolio`} variant="excerpt" component={component} />
    </div>
  );
}
