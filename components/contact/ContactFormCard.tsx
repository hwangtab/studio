import React, { type ChangeEvent, type FormEvent } from 'react';
import { m } from 'framer-motion';
import { CheckCircle, Mail, MessageCircle, Phone, Send, User } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import type { SiteConfig } from '../../types/data';
import type { ContactFormData } from '../../utils/useContactForm';
import { trackLeadEvent } from '../../utils/analytics';
import EnglishFastContactActions from './EnglishFastContactActions';
import KoreanFastContactActions from './KoreanFastContactActions';
import ContactFormErrorFallback from './ContactFormErrorFallback';
import InputField from './InputField';
import type { ContactTranslate } from './contactTypes';

type ContactErrors = Record<'name' | 'email' | 'phone' | 'message', string>;
type MotionDivProps = Omit<React.ComponentProps<typeof m.div>, 'className' | 'children'>;

interface ContactFormCardProps {
  locale: Locale;
  siteConfig: SiteConfig;
  t: ContactTranslate;
  validationCopy: { errorsFound: string };
  formData: ContactFormData;
  errors: ContactErrors;
  submitMessage: string;
  isSubmitSuccess: boolean;
  isSubmitting: boolean;
  canRetrySubmit: boolean;
  retryLabel: string;
  errorCount: number;
  noticeItems: string[] | null;
  motionProps?: MotionDivProps;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onRetrySubmit: () => void;
}

const interactiveMotionProps = { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 } };

const ContactFormCard = ({
  locale,
  siteConfig,
  t,
  validationCopy,
  formData,
  errors,
  submitMessage,
  isSubmitSuccess,
  isSubmitting,
  canRetrySubmit,
  retryLabel,
  errorCount,
  noticeItems,
  motionProps,
  onChange,
  onBlur,
  onSubmit,
  onRetrySubmit,
}: ContactFormCardProps) => (
  <m.div
    {...motionProps}
    className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl order-1 lg:order-2"
  >
    <div>
      <h2 className="typo-card-title mb-4">{t('contact.title')}</h2>
      {locale === 'ko' && (
        <KoreanFastContactActions
          locale={locale}
          naverMapUrl={siteConfig.contact.naverMapUrl}
          kakaoUrl={siteConfig.contact.kakaoUrl}
          phone={siteConfig.contact.phone}
        />
      )}
      {locale === 'en' && (
        <EnglishFastContactActions
          locale={locale}
          kakaoUrl={siteConfig.contact.kakaoUrl}
          email={siteConfig.contact.email}
          phone={siteConfig.contact.phone}
        />
      )}
      {submitMessage && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`mb-4 p-4 rounded-md flex items-center ${isSubmitSuccess ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}
        >
          {isSubmitSuccess && <CheckCircle className="mr-2" size={18} aria-hidden="true" />}
          {submitMessage}
        </div>
      )}
      {canRetrySubmit && !isSubmitting && (
        <button
          type="button"
          onClick={onRetrySubmit}
          className="mb-4 inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-md border border-primary/30 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          {retryLabel}
        </button>
      )}
      {submitMessage && !isSubmitSuccess && (
        <ContactFormErrorFallback
          locale={locale}
          kakaoUrl={siteConfig.contact.kakaoUrl}
          phone={siteConfig.contact.phone}
          email={siteConfig.contact.email}
          t={t}
        />
      )}
      {errorCount > 1 && (
        <div role="alert" aria-live="polite" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {t('contact.form.errorsFound', {
              count: errorCount,
              defaultValue: validationCopy.errorsFound,
            })}
          </p>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="text"
          name="company"
          value={formData.company}
          onChange={onChange}
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
          onChange={onChange}
          onBlur={onBlur}
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
          onChange={onChange}
          onBlur={onBlur}
          error={errors.phone}
          placeholder={t('contact.form.phonePlaceholder')}
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
          onChange={onChange}
          onBlur={onBlur}
          error={errors.email}
          placeholder={t('contact.form.emailPlaceholder')}
          required
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
        />

        <div className="relative mb-6">
          <label htmlFor="message" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{t('contact.form.message')}</label>
          <div className="relative">
            <div className="absolute top-3 left-3 pointer-events-none">
              <Send className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </div>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={onChange}
              onBlur={onBlur}
              aria-required="true"
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? 'message-error' : undefined}
              placeholder={t('contact.form.messagePlaceholder')}
              className={`w-full pl-10 pr-3 py-2 border ${errors.message ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent`}
              rows={8}
              required
              autoComplete="on"
            ></textarea>
          </div>
          {errors.message && (
            <span id="message-error" role="alert" className="text-xs text-red-600 mt-1 pl-10 block">
              {errors.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <m.button
            {...interactiveMotionProps}
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-1 font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200 font-title disabled:opacity-50 touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-1 text-gray-900 dark:text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors duration-200 font-title touch-manipulation"
          >
            <MessageCircle className="mr-2" size={18} aria-hidden="true" />
            {t('contact.form.kakao')}
          </m.a>
        </div>
      </form>
    </div>

    <div className="mt-6 space-y-4">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <h3 className="typo-card-subtitle text-blue-800 dark:text-blue-300 mb-2">{t('contact.notice.title')}</h3>
        <ul className="typo-card-body text-blue-700 dark:text-blue-400 space-y-1">
          {noticeItems?.map((item, i) => (
            <li key={`${item}-${i}`}>{item}</li>
          ))}
          {!noticeItems && (
            <li>{t('contact.checkNotices')}</li>
          )}
        </ul>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="typo-card-subtitle text-gray-800 dark:text-gray-300 mb-2">{t('contact.notice.privacyTitle')}</h3>
        <p className="typo-card-body text-gray-600 dark:text-gray-400">
          {t('contact.notice.privacyText')}
        </p>
      </div>
    </div>
  </m.div>
);

export default ContactFormCard;
