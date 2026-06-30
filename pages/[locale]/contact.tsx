import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { CheckCircle, ArrowRight } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import ContactFormCard from '../../components/contact/ContactFormCard';
import ContactInfoCard from '../../components/contact/ContactInfoCard';
import { Section } from '../../components/ui/Section';
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
        const faqItems = t('contact.faq', { returnObjects: true });
        const items = Array.isArray(whatToExpectItems) ? whatToExpectItems as string[] : [];
        const faqs = Array.isArray(faqItems) ? faqItems as { q: string; a: string }[] : [];
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
                        <dt className="font-semibold text-gray-900 dark:text-white mb-1">{faq.q}</dt>
                        <dd className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{faq.a}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </Section>
        );
      })()}

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
