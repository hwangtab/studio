import React from 'react';
import { m } from 'framer-motion';
import { Mail, MapPin, MessageCircle, Phone } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import type { SiteConfig } from '../../types/data';
import { trackLeadEvent } from '../../utils/analytics';
import type { ContactTranslate } from './contactTypes';

// Google Maps `hl` expects BCP-47 compatible codes. The site locale codes are
// short forms, so keep the map embed language explicit.
export const GOOGLE_MAPS_HL: Record<Locale, string> = {
  ko: 'ko',
  en: 'en',
  zh: 'zh-CN',
  es: 'es',
  vi: 'vi',
  th: 'th',
  uz: 'en',
};

type MotionDivProps = Omit<React.ComponentProps<typeof m.div>, 'className' | 'children'>;

interface ContactInfoCardProps {
  locale: Locale;
  siteConfig: SiteConfig;
  t: ContactTranslate;
  motionProps?: MotionDivProps;
  directionsMotionProps?: MotionDivProps;
}

const ContactInfoCard = ({
  locale,
  siteConfig,
  t,
  motionProps,
  directionsMotionProps,
}: ContactInfoCardProps) => {
  // 요일 묶음이 서로 다른 시간을 가질 때만 여러 줄로 낸다. 값이 전부 같으면 한 줄로 접는다.
  const rawHours = [
    { label: t('contact.hours.weekdaysLabel'), time: t('contact.hours.weekdaysTime') },
    { label: t('contact.hours.satLabel'), time: t('contact.hours.satTime') },
    { label: t('contact.hours.sunLabel'), time: t('contact.hours.sunTime') },
  ];
  const hoursRows = new Set(rawHours.map((row) => row.time)).size === 1
    ? [rawHours[0]]
    : rawHours;

  return (
  <m.div
    {...motionProps}
    className="glass-card p-8 rounded-2xl order-2 lg:order-1"
  >
    <div>
      <h2 className="typo-card-title mb-4">{t('contact.info.title')}</h2>
      <div className="space-y-4">
        <a
          href={siteConfig.contact.naverMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackLeadEvent('lead_click_naver_map', {
              locale,
              component: 'ContactPage',
              cta_id: 'contact_info_naver_map',
            })
          }
          className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors touch-manipulation"
        >
          <MapPin className="w-5 h-5 mr-2 text-primary dark:text-primary-lighter" aria-hidden="true" />
          <span className="leading-relaxed">{siteConfig.contact.address}</span>
        </a>
        <a
          href={`tel:${siteConfig.contact.phone}`}
          onClick={() =>
            trackLeadEvent('lead_click_phone', {
              locale,
              component: 'ContactPage',
              cta_id: 'contact_info_phone',
            })
          }
          className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors touch-manipulation"
        >
          <Phone className="w-5 h-5 mr-2 text-primary dark:text-primary-lighter" aria-hidden="true" />
          <span className="leading-relaxed">{siteConfig.contact.phone}</span>
        </a>
        <a
          href={`mailto:${siteConfig.contact.email}`}
          onClick={() =>
            trackLeadEvent('lead_click_email', {
              locale,
              component: 'ContactPage',
              cta_id: 'contact_info_email',
            })
          }
          className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors touch-manipulation"
        >
          <Mail className="w-5 h-5 mr-2 text-primary dark:text-primary-lighter" aria-hidden="true" />
          <span className="leading-relaxed">{siteConfig.contact.email}</span>
        </a>
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackLeadEvent('lead_click_kakao', {
              locale,
              component: 'ContactPage',
              cta_id: 'contact_info_kakao',
            })
          }
          className="flex items-center typo-card-body hover:text-primary dark:hover:text-primary-lighter transition-colors touch-manipulation"
        >
          <MessageCircle className="w-5 h-5 mr-2 text-primary dark:text-primary-lighter" aria-hidden="true" />
          <span className="leading-relaxed">{t('actions.kakao')}</span>
        </a>
      </div>
      <div className="mt-6">
        <h3 className="typo-card-title mb-4">{t('contact.info.location')}</h3>
        <div className="mb-6">
          <iframe
            src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3160.8635287891844!2d126.92362527640926!3d37.61435329999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357c977d6c9b9b61%3A0x4ba77c752231fd06!2z7Iqk7Yqc65SU7Jik64W4!5e0!3m2!1s${GOOGLE_MAPS_HL[locale]}!2skr!4v1704364800000!5m2!1s${GOOGLE_MAPS_HL[locale]}!2skr&hl=${GOOGLE_MAPS_HL[locale]}`}
            width="100%"
            height="250"
            style={{ border: 0, borderRadius: '0.5rem' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={t('contact.info.location')}
          ></iframe>
        </div>

        <m.div
          {...directionsMotionProps}
          className="mt-12 p-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700"
        >
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary dark:text-primary-lighter" />
            {t('contact.directions.title')}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {t('contact.directions.description')}
          </p>
        </m.div>
      </div>

      <div className="mt-8">
        <h3 className="typo-card-title mb-4">{t('contact.info.hours')}</h3>
        {/* 요일별 값이 전부 같으면 한 줄로 낸다 — 현재 연중무휴 24시간이라 셋 다 같은
            문구이고, 그대로 세 줄을 내면 같은 말이 반복돼 오히려 읽기 나쁘다. 요일별로
            갈리는 날이 오면 아래 분기가 자동으로 세 줄로 돌아간다. */}
        <div className="space-y-2">
          {hoursRows.length === 1 ? (
            <div className="flex justify-between items-center">
              <span className="dark:text-gray-300 typo-card-body">{t('contact.hours.everydayLabel')}</span>
              <span className="dark:text-gray-300">{hoursRows[0].time}</span>
            </div>
          ) : (
            hoursRows.map((row) => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="dark:text-gray-300 typo-card-body">{row.label}</span>
                <span className="dark:text-gray-300">{row.time}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="typo-card-body text-blue-800 dark:text-blue-300">
            <span className="typo-card-body text-blue-900 dark:text-blue-200">{t('contact.info.parking')}:</span> {t('contact.info.parkingDetail')}
          </p>
          <p className="typo-card-body text-blue-800 dark:text-blue-300 mt-1">
            <span className="typo-card-body text-blue-900 dark:text-blue-200">{t('contact.info.transport')}:</span> {t('contact.info.transportDetail')}
          </p>
        </div>
      </div>
    </div>
  </m.div>
  );
};

export default ContactInfoCard;
