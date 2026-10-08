import React from 'react';
import { Mail, MessageCircle, Phone } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

interface EnglishFastContactActionsProps {
  locale: Locale;
  kakaoUrl: string;
  email: string;
  phone: string;
}

const EnglishFastContactActions = ({ locale, kakaoUrl, email, phone }: EnglishFastContactActionsProps) => (
  <Notice
    tone="warning"
    icon={false}
    title="Fastest way to reach Studio NOL"
    className="mb-6"
    actions={
      <div className="w-full">
        {/* 카톡을 primary(전체 너비)로 유지 — GA4상 영어권 실질 전환은 카카오 클릭이 사실상 전부.
            단 카톡 미사용 방문자를 위해 이메일을 전체너비 보조 1순위로 승격하고, 안내 문구로 이메일/폼 경로를 환영. */}
        <Button asChild variant="kakao" fullWidth>
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
          >
            <MessageCircle size={20} aria-hidden="true" />
            Message on KakaoTalk
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm" fullWidth className="mt-2">
          <a
            href={`mailto:${email}`}
            onClick={() =>
              trackLeadEvent('lead_click_email', {
                locale,
                component: 'EnglishFastContactActions',
                cta_id: 'en_contact_fast_email',
              })
            }
          >
            <Mail size={18} aria-hidden="true" />
            Email Studio NOL
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm" fullWidth className="mt-2">
          <a
            href={`tel:${phone}`}
            onClick={() =>
              trackLeadEvent('lead_click_phone', {
                locale,
                component: 'EnglishFastContactActions',
                cta_id: 'en_contact_fast_phone',
              })
            }
          >
            <Phone size={18} aria-hidden="true" />
            Call Studio NOL
          </a>
        </Button>
        <p className="mt-3 text-sm leading-relaxed">
          No KakaoTalk? Email us or use the form below — we reply within 24 hours.
        </p>
      </div>
    }
  >
    <p className="text-sm leading-relaxed">
      Book in English · Recording, mixing &amp; mastering · Remote mixing worldwide
    </p>
    {/* 가격 즉답 — ChatGPT 등 LLM 유입 영어 방문자(이탈률 64%)가 클릭 없이 핵심 요금을
        바로 확인하도록 상단 노출. 수치는 pricing.ts SSOT / llms.txt English Quick Facts와 일치. */}
    <p className="mt-1 text-sm font-medium">
      Recording ₩100,000/hr · 1-song vocal package ₩250,000 · Mixing from ₩200,000/song
    </p>
    <a
      href={`/${locale}/pricing`}
      className="mt-2 inline-block rounded text-xs font-semibold text-primary dark:text-primary-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
    >
      See transparent pricing →
    </a>
  </Notice>
);

export default EnglishFastContactActions;
