import React from 'react';
import { ArrowRight, CheckCircle2, MessageCircle } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface InlineBookingCalloutProps {
  /** 사용자에게 보일 짧은 안내 문구. arg 미명시 시 default 카피 사용. */
  message?: string;
  locale: Locale;
}

const KO_TIPS = [
  '작업 유형 (녹음 / 믹싱 / 마스터링 / 레슨 등)',
  '곡 수 또는 작업 분량',
  '희망 일정·기간',
  '예산 또는 참고 자료 (있다면)',
];

/**
 * 본문 안 카카오톡 예약 박스. %%booking%% 또는 %%booking:메시지%% short-code로 트리거.
 * primary action은 siteConfig.contact.kakaoUrl 외부 링크 (새 창).
 * 한국어 본문에선 메시지 작성 팁 4개 노출 — 빈손으로 카톡 보내는 부담을 줄이고 응답 속도도 빨라짐.
 */
const InlineBookingCallout = ({ message, locale }: InlineBookingCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const headline = message?.trim()
    || t('stories.inline.bookingDefault', { defaultValue: '바로 상담·예약하고 싶으시다면' });
  const categoryLabel = t('stories.inline.bookingLabel', { defaultValue: '카카오톡 상담' });
  const isKo = locale === 'ko';
  const tips = isKo ? KO_TIPS : [];

  return (
    <aside
      data-inline-callout="booking"
      aria-label={categoryLabel}
      className="my-8 rounded-xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="inline-flex items-center justify-center p-1.5 rounded-full bg-amber-300/40 dark:bg-amber-500/30"
          aria-hidden="true"
        >
          <MessageCircle className="text-amber-700 dark:text-amber-300" size={14} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          {categoryLabel}
        </span>
      </div>

      <h4 className="typo-card-subtitle text-gray-900 dark:text-white mb-2">
        {headline}
      </h4>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {t('stories.inline.bookingBody', {
          defaultValue: '카카오톡 채널로 메시지 주시면 빠르게 답변드립니다. 아래 내용만 간단히 적어주시면 됩니다.',
        })}
      </p>

      {tips.length > 0 && (
        <ul className="space-y-1.5 mb-5">
          {tips.map((tip, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <CheckCircle2
                className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                size={16}
                aria-hidden="true"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}

      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackLeadEvent('lead_click_kakao', {
            locale,
            component: 'InlineBookingCallout',
            cta_id: 'inline_booking_kakao',
            booking_message: headline,
          })
        }
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
      >
        {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    </aside>
  );
};

export default React.memo(InlineBookingCallout);
