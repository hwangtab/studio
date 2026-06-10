import React from 'react';
import { Mail, MessageCircle, Phone } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface EnglishFastContactActionsProps {
  locale: Locale;
  kakaoUrl: string;
  email: string;
  phone: string;
}

const EnglishFastContactActions = ({ locale, kakaoUrl, email, phone }: EnglishFastContactActionsProps) => (
  <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-500/30 dark:bg-yellow-500/10">
    <p className="text-sm font-semibold text-gray-950 dark:text-yellow-100">
      Fastest way to reach Studio NOL
    </p>
    <p className="mt-1 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
      English-speaking engineers · Recording, mixing &amp; mastering · Transparent quote before you book
    </p>
    {/* 카톡을 primary(전체 너비)로, 이메일/전화는 보조 2열로 — GA4상 영어권 실질 전환은
        카카오 클릭이 사실상 전부고 폼/이메일은 거의 0이라 카톡을 시각적으로 우선 노출. */}
    <a
      href={kakaoUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        trackLeadEvent('lead_click_kakao', {
          locale,
          component: 'EnglishFastContactActions',
          cta_id: 'en_contact_fast_kakao',
        })
      }
      className="mt-3 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md bg-yellow-400 px-4 py-3 text-base font-bold text-gray-950 shadow-sm transition-colors hover:bg-yellow-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
    >
      <MessageCircle size={20} aria-hidden="true" />
      Message on KakaoTalk
    </a>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <a
        href={`mailto:${email}`}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <Mail size={18} aria-hidden="true" />
        Email Studio NOL
      </a>
      <a
        href={`tel:${phone}`}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <Phone size={18} aria-hidden="true" />
        Call Studio NOL
      </a>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
      The email form is still available below, but KakaoTalk is the most reliable path for quick scheduling.
    </p>
  </div>
);

export default EnglishFastContactActions;
