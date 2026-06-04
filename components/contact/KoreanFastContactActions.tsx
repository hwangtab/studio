import React from 'react';
import { MapPin, MessageCircle, Phone } from 'lucide-react';
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
    <p className="text-sm font-semibold text-gray-950 dark:text-primary-light">
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
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
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
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-yellow-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
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
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <Phone size={18} aria-hidden="true" />
        전화
      </a>
    </div>
  </div>
);

export default KoreanFastContactActions;
