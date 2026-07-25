import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { CheckCircle, ArrowRight, MessageCircle } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import ContactFormCard from '../../components/contact/ContactFormCard';
import ContactInfoCard from '../../components/contact/ContactInfoCard';
import { Section } from '../../components/ui/Section';
import { RECORDING_HOURLY_PRICE, VOCAL_PACKAGE_PRICE, formatPriceAmount } from '../../data/pricing';
import { trackLeadEvent } from '../../utils/analytics';
// FAQPage 스키마(faqItems)와 가시 콘텐츠를 동일 소스로 유지하기 위한 렌더 컴포넌트.
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getFaqData } from '../../data/faq';
import { NextPageWithLayout } from '../../types';

import { getValidationFallbacks } from '../../utils/contactMessages';
import { useContactForm } from '../../utils/useContactForm';
import { createEnterAnimation, createInViewEnterAnimation } from '../../utils/animationUtils';

interface ContactProps {
  locale: Locale;
}

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
    handleBlur,
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
        ogImage="/images/og-hardware5.webp"
        ogImageAlt={t('contact.heroAlt')}
        ogImageWidth={1200}
        ogImageHeight={630}
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
      <ImageHero
        {...{
          locale,
          priority: true,
          title: t('contact.heroTitle', { defaultValue: t('contact.title') }),
          subtitle: t('contact.heroSubtitle', { defaultValue: t('contact.subtitle') }),
          backgroundImage: "/images/hardware5.webp",
          imageAlt: t('contact.heroAlt'),
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/50 via-black/30 to-black/50",
          breadcrumbItems: [
            { name: t('nav.home'), path: `/${locale}` },
            { name: t('nav.contact'), path: `/${locale}/contact` },
          ],
        }}
      />

      {/* 영어권·AI(ChatGPT) 유입 즉답 블록 — /en/contact은 ChatGPT 최다 랜딩(90일 58세션).
          방문자가 폼을 만나기 전에 "영어 응대·가격·위치·예약법"을 즉시 확인하도록 폼 위 배치.
          en 전용이라 영어 리터럴 사용, 가격은 SSOT 상수 보간(드리프트 방지). */}
      {locale === 'en' && (
        <Section variant="default" className="pt-8 pb-0">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Studio NOL — an English-friendly recording studio in Seoul
              </h2>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5 mb-6">
                {[
                  'English booking & communication (KakaoTalk / email / phone)',
                  `Vocal recording from ₩${formatPriceAmount(RECORDING_HOURLY_PRICE)}/hour · single-song package ₩${formatPriceAmount(VOCAL_PACKAGE_PRICE)} (3 hrs)`,
                  '5-minute walk from Yeonsinnae Station (Seoul Metro Line 3 / Line 6)',
                  'Reply within 24 hours · mixing, mastering & release production available',
                ].map((fact, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={siteConfig.contact.kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackLeadEvent('lead_click_kakao', {
                      locale,
                      component: 'ContactPage',
                      cta_id: 'contact_en_quickfacts_kakao',
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors min-h-[44px] touch-manipulation"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  Chat on KakaoTalk
                </a>
                <Link
                  href={`/${locale}/recording`}
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-light hover:underline min-h-[44px]"
                >
                  Recording studio &amp; rates <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section variant="default">
        <div className="grid lg:grid-cols-2 gap-8 container mx-auto px-4 max-w-6xl">
          <ContactInfoCard
            locale={locale}
            siteConfig={siteConfig}
            t={t}
            motionProps={infoCardMotionProps}
            directionsMotionProps={directionsMotionProps}
          />

          <ContactFormCard
            locale={locale}
            siteConfig={siteConfig}
            t={t}
            validationCopy={validationCopy}
            formData={formData}
            errors={errors}
            submitMessage={submitMessage}
            isSubmitSuccess={isSubmitSuccess}
            isSubmitting={isSubmitting}
            canRetrySubmit={canRetrySubmit}
            retryLabel={retryLabel}
            errorCount={errorCount}
            noticeItems={resolvedNoticeList}
            motionProps={formCardMotionProps}
            onChange={handleChange}
            onBlur={handleBlur}
            onSubmit={handleSubmit}
            onRetrySubmit={handleRetrySubmit}
          />
        </div>
      </Section>

      {locale === 'en' && (() => {
        const whatToExpectItems = t('contact.whatToExpect.items', { returnObjects: true });
        const items = Array.isArray(whatToExpectItems) ? whatToExpectItems as string[] : [];
        // 가시 FAQ는 SEO faqItems(FAQPage 스키마)와 동일 소스(contactFaqData)여야 한다 —
        // 스키마 항목 ≠ 본문 항목이면 구조화 데이터 가이드라인 위반(스팸 판정 리스크).
        const faqs = contactFaqData;
        return (
          <Section variant="alternate" className="py-12">
            <div className="container mx-auto px-4 max-w-6xl">
              <div className="grid md:grid-cols-2 gap-10">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-5">
                    {t('contact.whatToExpect.title')}
                  </h2>
                  <ul className="space-y-3">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-5">FAQ</h2>
                  <dl className="space-y-5">
                    {faqs.map((faq, i) => (
                      <div key={i}>
                        <dt className="font-semibold text-gray-900 dark:text-white mb-1">{faq.question}</dt>
                        <dd className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{faq.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </Section>
        );
      })()}

      {/* 비-en 로케일 가시 FAQ — SEO faqItems(FAQPage 스키마)와 동일 소스.
          en은 위 whatToExpect 블록의 FAQ 칼럼이 같은 역할을 한다. */}
      {locale !== 'en' && contactFaqData.length > 0 && (
        <FAQSection
          items={contactFaqData}
          title={t('contact.faqSection.title')}
          subtitle={t('contact.faqSection.subtitle')}
          variant="alternate"
        />
      )}

      {/* 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/stories`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.stories')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/studio-info`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/lesson`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
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
