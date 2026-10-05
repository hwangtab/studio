import React from 'react';
import Link from 'next/link';
import { MapPin, MessageCircle, Phone } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

interface KoreanFastContactActionsProps {
  locale: Locale;
  naverMapUrl: string;
  kakaoUrl: string;
  phone: string;
}

const KoreanFastContactActions = ({ locale, naverMapUrl, kakaoUrl, phone }: KoreanFastContactActionsProps) => (
  <Notice
    tone="brand"
    icon={false}
    title="빠른 문의·방문 경로"
    className="mb-6"
    actions={
      <div className="w-full">
        <div className="grid gap-2 sm:grid-cols-3">
          {/* 네이버 지도는 Button에 없는 색이라 solid 위에 green을 덮는다 — 흰 글씨 위 green-600(#16a34a)은
              3.30:1로 AA(4.5:1) 미달이었다. 14px semibold라 대형 텍스트 완화(18.66px bold)에도 못 걸린다.
              green-700(#15803d)이 5.02:1. 포커스 링도 /40 알파가 아니라 불투명 green-700을 써야
              SC 1.4.11(3:1)을 넘는다. */}
          <Button asChild size="sm" className="bg-green-700 hover:bg-green-800 focus-visible:ring-green-700">
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
            >
              <MapPin size={18} aria-hidden="true" />
              네이버 지도
            </a>
          </Button>
          <Button asChild variant="kakao" size="sm">
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
            >
              <MessageCircle size={18} aria-hidden="true" />
              카카오톡
            </a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a
              href={`tel:${phone}`}
              onClick={() =>
                trackLeadEvent('lead_click_phone', {
                  locale,
                  component: 'KoreanFastContactActions',
                  cta_id: 'ko_contact_fast_phone',
                })
              }
            >
              <Phone size={18} aria-hidden="true" />
              전화
            </a>
          </Button>
        </div>
        {/* 견적 요청서 — 무엇을 물어야 할지 모르는 분께. 카카오가 아니라 옐로 금지. */}
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          무엇부터 물어야 할지 모르겠다면{' '}
          <Link
            href="/ko/quote"
            prefetch={false}
            className="font-semibold text-primary underline underline-offset-4 hover:text-primary-dark dark:text-primary-lighter dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 rounded"
          >
            견적 요청서로 예상 비용부터 보기
          </Link>
        </p>
      </div>
    }
  />
);

export default KoreanFastContactActions;
