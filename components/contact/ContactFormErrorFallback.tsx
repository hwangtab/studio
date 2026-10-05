import React from 'react';
import { Mail, MessageCircle, Phone } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';
import type { ContactTranslate } from './contactTypes';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

interface ContactFormErrorFallbackProps {
  locale: Locale;
  kakaoUrl: string;
  phone: string;
  email: string;
  t: ContactTranslate;
}

const ContactFormErrorFallback = ({ locale, kakaoUrl, phone, email, t }: ContactFormErrorFallbackProps) => (
  <Notice
    tone="warning"
    className="mb-6"
    actions={
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        {/* 카카오 목적지만 옐로(카카오 배색 규칙) — 전화·메일은 secondary. */}
        <Button asChild variant="kakao" size="sm" className="flex-1 touch-manipulation">
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'ContactFormErrorFallback',
                cta_id: 'contact_form_error_kakao',
              })
            }
          >
            <MessageCircle size={18} aria-hidden="true" />
            {t('actions.kakao')}
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm" className="flex-1 touch-manipulation">
          <a
            href={`tel:${phone}`}
            onClick={() =>
              trackLeadEvent('lead_click_phone', {
                locale,
                component: 'ContactFormErrorFallback',
                cta_id: 'contact_form_error_phone',
              })
            }
          >
            <Phone size={18} aria-hidden="true" />
            {phone}
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm" className="flex-1 touch-manipulation">
          <a
            href={`mailto:${email}`}
            onClick={() =>
              trackLeadEvent('lead_click_email', {
                locale,
                component: 'ContactFormErrorFallback',
                cta_id: 'contact_form_error_email',
              })
            }
          >
            <Mail size={18} aria-hidden="true" />
            {email}
          </a>
        </Button>
      </div>
    }
  >
    <p className="font-medium">
      {t('contact.form.failFallback', { defaultValue: '전송이 안 되면 아래로 바로 연락 주세요.' })}
    </p>
  </Notice>
);

export default ContactFormErrorFallback;
