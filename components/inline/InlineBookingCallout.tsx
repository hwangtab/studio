import React from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';

interface InlineBookingCalloutProps {
  /** 사용자에게 보일 짧은 안내 문구. arg 미명시 시 default 카피 사용. */
  message?: string;
  locale: Locale;
}

/**
 * 본문 안 카카오톡 예약 박스. %%booking%% 또는 %%booking:메시지%% short-code로 트리거.
 * primary action은 siteConfig.contact.kakaoUrl 외부 링크 (새 창).
 */
const InlineBookingCallout = ({ message, locale }: InlineBookingCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const headline = message?.trim()
    || t('stories.inline.bookingDefault', { defaultValue: '바로 상담·예약하고 싶으시다면' });

  return (
    <aside
      data-inline-callout="booking"
      aria-label={t('stories.inline.bookingLabel', { defaultValue: '카카오톡 예약 문의' })}
      className="my-8 rounded-xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-6"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-amber-300/40 dark:bg-amber-500/30" aria-hidden="true">
          <MessageCircle className="text-amber-700 dark:text-amber-300" size={20} />
        </div>
        <h4 className="typo-card-subtitle text-gray-900 dark:text-white">
          {headline}
        </h4>
      </div>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {t('stories.inline.bookingBody', {
          defaultValue: '카카오톡 채널로 메시지 주시면 빠르게 답변드립니다. 곡 정보·일정·궁금한 점만 간단히 적어 주시면 됩니다.',
        })}
      </p>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
      >
        {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    </aside>
  );
};

export default React.memo(InlineBookingCallout);
