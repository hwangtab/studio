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
    <a
      href={`/${locale}/pricing`}
      className="mt-2 inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
    >
      See transparent pricing →
    </a>
    {/* 카톡을 primary(전체 너비)로 유지 — GA4상 영어권 실질 전환은 카카오 클릭이 사실상 전부.
        단 카톡 미사용 방문자를 위해 이메일을 전체너비 보조 1순위로 승격하고, 안내 문구로 이메일/폼 경로를 환영. */}
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
    <a
      href={`mailto:${email}`}
      className="mt-2 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
    >
      <Mail size={18} aria-hidden="true" />
      Email Studio NOL
    </a>
    <a
      href={`tel:${phone}`}
      className="mt-2 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
    >
      <Phone size={18} aria-hidden="true" />
      Call Studio NOL
    </a>
    <p className="mt-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
      No KakaoTalk? Email us or use the form below — we reply within 24 hours.
    </p>
  </div>
);

export default EnglishFastContactActions;
