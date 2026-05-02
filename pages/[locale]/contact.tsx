import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { MapPin, Phone, Mail, User, Send, CheckCircle, MessageCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import Hero from '../../components/ui/Hero';
import Section from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getFaqData } from '../../data/faq';
import { NextPageWithLayout } from '../../types';

import { getValidationFallbacks } from '../../utils/contactMessages';
import { useContactForm } from '../../utils/useContactForm';
import { trackLeadEvent } from '../../utils/analytics';
import { createEnterAnimation, createInViewEnterAnimation } from '../../utils/animationUtils';

interface ContactProps {
  locale: Locale;
}

// Google Maps `hl` 파라미터는 BCP-47 호환 코드를 기대한다. 사이트 i18n 코드는
// short form(zh, vi, th 등)이라 1:1 매핑이 필요하다. 우즈베크어는 Google Maps가
// 공식 지원하지 않아 영어로 폴백 — 우리 콘텐츠 zh도 simplified 한 종류만 다루므로
// zh-TW 사용자에게도 zh-CN을 보낸다.
const GOOGLE_MAPS_HL: Record<Locale, string> = {
  ko: 'ko',
  en: 'en',
  zh: 'zh-CN',
  es: 'es',
  vi: 'vi',
  th: 'th',
  uz: 'en',
};

const inputClass = [
  'w-full',
  'bg-canvas-soft border border-hairline-strong rounded-whisper px-3.5 py-2.5',
  'focus:outline-none focus:border-link-focus focus:ring-2 focus:ring-link-focus/20',
  'text-ink dark:bg-canvas-deep dark:text-on-dark dark:border-white/15',
  'placeholder:text-ink-muted-60 dark:placeholder:text-on-dark-soft',
].join(' ');

const inputErrorClass = [
  'w-full',
  'bg-canvas-soft border border-red-400 rounded-whisper px-3.5 py-2.5',
  'focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-400/20',
  'text-ink dark:bg-canvas-deep dark:text-on-dark dark:border-red-500',
  'placeholder:text-ink-muted-60 dark:placeholder:text-on-dark-soft',
].join(' ');

const labelClass = 'text-[14px] font-medium text-ink dark:text-on-dark mb-2 block';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  label: string;
  id: string;
  error?: string;
}

const InputField = ({ icon: Icon, label, id, error, ...props }: InputFieldProps) => (
  <div className="relative mb-4">
    <label htmlFor={id} className={labelClass}>{label}</label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Icon className="w-5 h-5 text-ink-muted-60 dark:text-on-dark-soft" aria-hidden="true" />
      </div>
      <input
        id={id}
        aria-required={props.required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`pl-10 pr-3 ${error ? inputErrorClass : inputClass}`}
        {...props}
      />
    </div>
    {error && <span id={`${id}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1 pl-10 block">{error}</span>}
  </div>
);

const Contact: NextPageWithLayout<ContactProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });

  const validationCopy = getValidationFallbacks(locale);
  const {
    formData,
    errors,
    submitMessage,
    isSubmitSuccess,
    isSubmitting,
    canRetrySubmit,
    retryLabel,
    errorCount,
    handleChange,
    handleSubmit,
    handleRetrySubmit,
  } = useContactForm({ locale, t });
  const siteConfig = getSiteConfig(locale);
  const contactFaqData = React.useMemo(() => {
    const allFaq = getFaqData(locale);
    return allFaq.filter(faq => {
      const text = (faq.question + faq.answer).toLowerCase();
      return ['위치', '어디', '영업', '주말', '초보', 'location', 'where', 'hours', 'weekend', 'beginner', '哪里', '位于', 'ở đâu', 'อยู่ที่ไหน', 'qayerda'].some(kw => text.includes(kw));
    });
  }, [locale]);
  const infoCardMotionProps = createEnterAnimation({ axis: 'x', distance: -50, duration: 0.5 });
  const directionsMotionProps = createInViewEnterAnimation({ duration: 0.5, delay: 0.4 });
  const formCardMotionProps = createEnterAnimation({ axis: 'x', distance: 50, duration: 0.5, delay: 0.2 });
  const interactiveMotionProps = { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 } };
  const noticeList = t('contact.notice.list', { returnObjects: true });
  const resolvedNoticeList = Array.isArray(noticeList) ? noticeList : null;

  const contactPageSchema = React.useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: `${siteConfig.url}/${locale}/contact`,
    telephone: `+82-${siteConfig.contact.phone.replace(/^0/, '')}`,
    email: siteConfig.contact.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
      addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
      postalCode: '03424',
      addressCountry: 'KR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 37.614353,
      longitude: 126.925887,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: `+82-${siteConfig.contact.phone.replace(/^0/, '')}`,
      email: siteConfig.contact.email,
      url: `${siteConfig.url}/${locale}/contact`,
      availableLanguage: ['Korean', 'English'],
    },
  }), [siteConfig, locale]);

  return (
    <>
      <SEO
        locale={locale}
        title={t('contact.seo.title')}
        description={t('contact.seo.description')}
        keywords={t('contact.seo.keywords')}
        ogImage="/images/hardware5.webp"
        ogImageAlt={t('contact.heroAlt')}
        ogImageWidth={1280}
        ogImageHeight={720}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.contact'), path: `/${locale}/contact` },
        ]}
        includeSchema={true}
        canonical={`/${locale}/contact`}
        faqItems={contactFaqData}
        webPageType="ContactPage"
        schema={contactPageSchema}
      />

      <Hero
        variant="lightEditorial"
        eyebrow={t('nav.contact')}
        title={t('contact.title')}
        lead={t('contact.lead')}
        orbs={[{ color: 'sky', size: 600, top: '-100px', right: '-80px', opacity: 0.4 }]}
      />

      <Section tone="canvas">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Info card */}
          <m.div
            {...infoCardMotionProps}
            className="order-2 lg:order-1"
          >
            <div>
              <h2 className="font-display font-light text-display-sm text-ink dark:text-on-dark mb-4">{t('contact.info.title')}</h2>
              <div className="space-y-4">
                <a href={siteConfig.contact.naverMapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-ink-muted-80 dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors touch-manipulation">
                  <MapPin className="w-5 h-5 mr-2 text-ink-muted-60 dark:text-on-dark-soft" aria-hidden="true" />
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
                  className="flex items-center text-ink-muted-80 dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors touch-manipulation"
                >
                  <Phone className="w-5 h-5 mr-2 text-ink-muted-60 dark:text-on-dark-soft" aria-hidden="true" />
                  <span className="leading-relaxed">{siteConfig.contact.phone}</span>
                </a>
                <a href={`mailto:${siteConfig.contact.email}`} className="flex items-center text-ink-muted-80 dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors touch-manipulation">
                  <Mail className="w-5 h-5 mr-2 text-ink-muted-60 dark:text-on-dark-soft" aria-hidden="true" />
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
                  className="flex items-center text-ink-muted-80 dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors touch-manipulation"
                >
                  <MessageCircle className="w-5 h-5 mr-2 text-ink-muted-60 dark:text-on-dark-soft" aria-hidden="true" />
                  <span className="leading-relaxed">{t('actions.kakao')}</span>
                </a>
              </div>
              <div className="mt-6">
                <h3 className="font-display font-light text-display-sm text-ink dark:text-on-dark mb-4">{t('contact.info.location')}</h3>
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

                {/* 오시는 길 설명 (GEO 최적화) */}
                <m.div
                  {...directionsMotionProps}
                  className="mt-12 p-8 bg-canvas-warm dark:bg-surface-dark-elevated rounded-hero border border-hairline dark:border-white/10"
                >
                  <h3 className="text-title-md font-display font-light text-ink dark:text-on-dark mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-ink-muted-60" />
                    {t('contact.directions.title')}
                  </h3>
                  <p className="text-ink-muted-80 dark:text-on-dark-soft leading-relaxed whitespace-pre-line">
                    {t('contact.directions.description')}
                  </p>
                </m.div>
              </div>

              {/* 지도 */}
              <div className="mt-8">
                <h3 className="font-display font-light text-display-sm text-ink dark:text-on-dark mb-4">{t('contact.info.hours')}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted-80 dark:text-on-dark-soft">{t('contact.hours.weekdaysLabel')}</span>
                    <span className="text-ink dark:text-on-dark">{t('contact.hours.weekdaysTime')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted-80 dark:text-on-dark-soft">{t('contact.hours.satLabel')}</span>
                    <span className="text-ink dark:text-on-dark">{t('contact.hours.satTime')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted-80 dark:text-on-dark-soft">{t('contact.hours.sunLabel')}</span>
                    <span className="text-red-600 dark:text-red-400">{t('contact.hours.closed')}</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-canvas-warm dark:bg-surface-dark-elevated rounded-card border border-hairline dark:border-white/10">
                  <p className="text-ink-muted-80 dark:text-on-dark-soft text-sm">
                    <span className="font-medium text-ink dark:text-on-dark">{t('contact.info.parking')}:</span> {t('contact.info.parkingDetail')}
                  </p>
                  <p className="text-ink-muted-80 dark:text-on-dark-soft text-sm mt-1">
                    <span className="font-medium text-ink dark:text-on-dark">{t('contact.info.transport')}:</span> {t('contact.info.transportDetail')}
                  </p>
                </div>
              </div>
            </div>
          </m.div>

          {/* Contact Form */}
          <m.div
            {...formCardMotionProps}
            className="order-1 lg:order-2"
          >
            <div className="bg-canvas-soft border border-hairline rounded-hero shadow-card p-6 md:p-8 dark:bg-surface-dark-elevated dark:border-white/10">
              <h2 className="font-display font-light text-display-sm text-ink dark:text-on-dark mb-4">{t('contact.title')}</h2>
              {submitMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mb-4 p-4 rounded-card flex items-center ${
                    isSubmitSuccess
                      ? 'bg-orb-mint/30 border border-orb-mint text-ink'
                      : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
                  }`}
                >
                  {isSubmitSuccess && <CheckCircle className="mr-2 flex-shrink-0" size={18} aria-hidden="true" />}
                  {submitMessage}
                </div>
              )}
              {canRetrySubmit && !isSubmitting && (
                <button
                  type="button"
                  onClick={handleRetrySubmit}
                  className="mb-4 inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-pill border border-hairline-strong text-sm font-medium text-ink hover:bg-ink/[0.04] dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06] transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
                >
                  {retryLabel}
                </button>
              )}
              {errorCount > 1 && (
                <div role="alert" aria-live="polite" className="mb-4 p-3 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 rounded-card">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    {t('contact.form.errorsFound', {
                      count: errorCount,
                      defaultValue: validationCopy.errorsFound,
                    })}
                  </p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot field */}
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="hidden"
                  autoComplete="off"
                  tabIndex={-1}
                  aria-hidden="true"
                />

                <InputField
                  icon={User}
                  id="name"
                  label={t('contact.form.name')}
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={errors.name}
                  placeholder={t('contact.form.namePlaceholder')}
                  required
                  autoComplete="name"
                />

                <InputField
                  icon={Phone}
                  id="phone"
                  label={t('contact.form.phone')}
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  error={errors.phone}
                  placeholder={t('contact.form.phonePlaceholder')}
                  required
                  autoComplete="tel"
                  inputMode="tel"
                />

                <InputField
                  icon={Mail}
                  id="email"
                  label={t('contact.form.email')}
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  placeholder={t('contact.form.emailPlaceholder')}
                  required
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                />

                <div className="relative mb-6">
                  <label htmlFor="message" className={labelClass}>{t('contact.form.message')}</label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <Send className="w-5 h-5 text-ink-muted-60 dark:text-on-dark-soft" aria-hidden="true" />
                    </div>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? "message-error" : undefined}
                      placeholder={t('contact.form.messagePlaceholder')}
                      className={`pl-10 pr-3 py-2.5 ${errors.message ? inputErrorClass.replace('px-3.5 py-2.5', '') : inputClass.replace('px-3.5 py-2.5', '')}`}
                      rows={8}
                      required
                      autoComplete="on"
                    ></textarea>
                  </div>
                  {errors.message && (
                    <span id="message-error" role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1 pl-10 block">
                      {errors.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <m.button
                    {...interactiveMotionProps}
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center items-center h-14 px-7 text-[17px] font-medium rounded-pill bg-ink text-white hover:bg-canvas-deep dark:bg-white dark:text-ink dark:hover:bg-on-dark-soft transition-all disabled:opacity-50 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('contact.form.loading')}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2" size={18} aria-hidden="true" />
                        {t('contact.form.submit')}
                      </>
                    )}
                  </m.button>

                  <m.a
                    {...interactiveMotionProps}
                    href={siteConfig.contact.kakaoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackLeadEvent('lead_click_kakao', {
                        locale,
                        component: 'ContactPage',
                        cta_id: 'contact_form_kakao',
                      })
                    }
                    className="w-full inline-flex justify-center items-center h-14 px-7 text-[17px] text-ink bg-yellow-400 hover:bg-yellow-500 rounded-pill font-medium transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:ring-offset-2"
                  >
                    <MessageCircle className="mr-2" size={18} aria-hidden="true" />
                    {t('contact.form.kakao')}
                  </m.a>
                </div>
              </form>

              <div className="mt-6 space-y-4">
                <div className="p-4 bg-canvas-warm dark:bg-surface-dark-elevated rounded-card border border-hairline dark:border-white/10">
                  <h3 className="text-[14px] font-medium text-ink dark:text-on-dark mb-2">{t('contact.notice.title')}</h3>
                  <ul className="text-ink-muted-80 dark:text-on-dark-soft text-sm space-y-1">
                    {resolvedNoticeList?.map((item, i) => (
                      <li key={`${item}-${i}`}>{item}</li>
                    ))}
                    {!resolvedNoticeList && (
                      <li>{t('contact.checkNotices')}</li>
                    )}
                  </ul>
                </div>

                <div className="border-t border-hairline dark:border-white/10 pt-4">
                  <h3 className="text-[14px] font-medium text-ink dark:text-on-dark mb-2">{t('contact.notice.privacyTitle')}</h3>
                  <p className="text-ink-muted-80 dark:text-on-dark-soft text-sm">
                    {t('contact.notice.privacyText')}
                  </p>
                </div>
              </div>
            </div>
          </m.div>
        </div>
      </Section>

      {/* 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section tone="warm" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/stories`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/studio-info`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/lesson`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>
    </>
  );
};

Contact.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  return buildPageStaticProps(locale, {}, { revalidate: 86400, i18nSections: ['contact'] });
};

export default Contact;
