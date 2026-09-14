import React from 'react';
import { MapPin, MessageCircle, Phone } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface KoreanFastContactActionsProps {
  locale: Locale;
  naverMapUrl: string;
  kakaoUrl: string;
  phone: string;
}

const KoreanFastContactActions = ({ locale, naverMapUrl, kakaoUrl, phone }: KoreanFastContactActionsProps) => (
  <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:border-primary-light/30 dark:bg-primary-light/10">
    <p className="text-sm font-semibold text-gray-950 dark:text-primary-lighter">
      빠른 문의·방문 경로
    </p>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      <a
        href={naverMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackLeadEvent('lead_click_naver_map', {
            locale,
            component: 'KoreanFastContactActions',
            cta_id: 'ko_contact_fast_naver_map',
          })
        }
        /* 흰 글씨 위 green-600(#16a34a)은 3.30:1로 AA(4.5:1) 미달이었다 — 14px semibold라
           대형 텍스트 완화(18.66px bold)에도 못 걸린다. green-700(#15803d)이 5.02:1.
           포커스 링도 /40 알파가 아니라 불투명 green-700을 써야 SC 1.4.11(3:1)을 넘는다. */
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        <MapPin size={18} aria-hidden="true" />
        네이버 지도
      </a>
      <a
        href={kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackLeadEvent('lead_click_kakao', {
            locale,
            component: 'KoreanFastContactActions',
            cta_id: 'ko_contact_fast_kakao',
          })
        }
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-kakao px-3 py-2 text-sm font-bold text-kakao-ink transition-colors hover:bg-kakao-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink dark:focus-visible:ring-kakao focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        <MessageCircle size={18} aria-hidden="true" />
        카카오톡
      </a>
      <a
        href={`tel:${phone}`}
        onClick={() =>
          trackLeadEvent('lead_click_phone', {
            locale,
            component: 'KoreanFastContactActions',
            cta_id: 'ko_contact_fast_phone',
          })
        }
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary dark:hover:text-primary-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <Phone size={18} aria-hidden="true" />
        전화
      </a>
    </div>
  </div>
);

export default KoreanFastContactActions;
