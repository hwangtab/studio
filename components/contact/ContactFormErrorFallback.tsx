import React from 'react';
import { Mail, MessageCircle, Phone } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';
import type { ContactTranslate } from './contactTypes';

interface ContactFormErrorFallbackProps {
  locale: Locale;
  kakaoUrl: string;
  phone: string;
  email: string;
  t: ContactTranslate;
}

const ContactFormErrorFallback = ({ locale, kakaoUrl, phone, email, t }: ContactFormErrorFallbackProps) => (
  <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
    <p className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-100">
      {t('contact.form.failFallback', { defaultValue: '전송이 안 되면 아래로 바로 연락 주세요.' })}
    </p>
    <div className="flex flex-col gap-2 sm:flex-row">
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
        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-kakao px-4 py-2 text-sm font-bold text-kakao-ink transition-colors hover:bg-kakao-dark touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink focus-visible:ring-offset-2"
      >
        <MessageCircle size={18} aria-hidden="true" />
        {t('actions.kakao')}
      </a>
      <a
        href={`tel:${phone}`}
        onClick={() =>
          trackLeadEvent('lead_click_phone', {
            locale,
            component: 'ContactFormErrorFallback',
            cta_id: 'contact_form_error_phone',
          })
        }
        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <Phone size={18} aria-hidden="true" />
        {phone}
      </a>
      <a
        href={`mailto:${email}`}
        onClick={() =>
          trackLeadEvent('lead_click_email', {
            locale,
            component: 'ContactFormErrorFallback',
            cta_id: 'contact_form_error_email',
          })
        }
        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <Mail size={18} aria-hidden="true" />
        {email}
      </a>
    </div>
  </div>
);

export default ContactFormErrorFallback;
