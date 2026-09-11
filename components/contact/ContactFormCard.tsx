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
import { Field, TextArea } from '../ui/Field';
import type { ContactTranslate } from './contactTypes';

type IconTextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  icon: React.ElementType;
  invalid?: boolean;
};

/**
 * 아이콘 슬롯 때문에 컨트롤을 relative 래퍼로 감싼다 — `Field`가 담지 못하는 부분이다.
 * `Field`가 주입하는 id·aria-*는 그대로 `TextArea`로 흘려보내고, invalid만 직접 넘긴다.
 */
const IconTextArea = ({ icon: Icon, invalid, className, ...props }: IconTextAreaProps) => (
  <div className="relative">
    <div className="absolute top-3 left-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
    </div>
    <TextArea invalid={invalid} className={['pl-10', className].filter(Boolean).join(' ')} {...props} />
  </div>
);

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
}: ContactFormCardProps) => {
  // 제출 결과 배너로 스크롤·포커스 이동. 긴 폼 하단에서 제출하면 상단 배너가 뷰포트
  // 밖이라 성공/실패를 놓칠 수 있어, 결과가 뜰 때마다 배너를 화면 중앙으로 가져오고
  // 포커스를 옮긴다(스크린리더는 role="status"로 이미 안내되지만 시각 사용자 보완).
  const messageRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!submitMessage) return;
    const el = messageRef.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
    el.focus();
  }, [submitMessage, isSubmitSuccess]);

  // 개인정보 수집·이용 동의(필수). 미동의 시 제출 차단.
  const [consent, setConsent] = React.useState(false);
  const [consentError, setConsentError] = React.useState(false);
  const consentRef = React.useRef<HTMLInputElement>(null);

  // 제출 성공 시 폼이 초기화되므로 동의 상태도 되돌린다.
  React.useEffect(() => {
    if (isSubmitSuccess) setConsent(false);
  }, [isSubmitSuccess]);

  const handleGatedSubmit = React.useCallback(
    (event: FormEvent) => {
      if (!consent) {
        event.preventDefault();
        setConsentError(true);
        consentRef.current?.focus();
        return;
      }
      setConsentError(false);
      void onSubmit(event);
    },
    [consent, onSubmit]
  );

  const privacyPolicyHref = `/${locale}/privacy-policy`;

  return (
  <m.div
    {...motionProps}
    className="glass-card p-8 rounded-lg order-1 lg:order-2"
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
          ref={messageRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`mb-4 p-4 rounded-md flex items-center outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isSubmitSuccess ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}
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
      <form onSubmit={handleGatedSubmit} className="space-y-4">
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

        <Field
          id="message"
          label={t('contact.form.message')}
          required
          error={errors.message}
          className="mb-6"
        >
          <IconTextArea
            icon={Send}
            invalid={!!errors.message}
            name="message"
            value={formData.message}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={t('contact.form.messagePlaceholder')}
            rows={8}
            required
            autoComplete="on"
          />
        </Field>

        <div className="flex items-start gap-2.5">
          <input
            ref={consentRef}
            type="checkbox"
            id="privacy-consent"
            name="privacyConsent"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (e.target.checked) setConsentError(false);
            }}
            aria-required="true"
            aria-invalid={consentError}
            aria-describedby={consentError ? 'privacy-consent-error' : undefined}
            className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 touch-manipulation"
          />
          <label htmlFor="privacy-consent" className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
            {t('contact.form.consentLabel', { defaultValue: '개인정보 수집·이용에 동의합니다 (필수)' })}{' '}
            <a
              href={privacyPolicyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline underline-offset-2"
            >
              {t('contact.form.consentPolicyLink', { defaultValue: '개인정보 처리방침' })}
            </a>
          </label>
        </div>
        {consentError && (
          <span id="privacy-consent-error" role="alert" className="block text-xs text-red-600">
            {t('contact.form.consentError', { defaultValue: '개인정보 수집·이용에 동의해 주세요.' })}
          </span>
        )}

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
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-body-1 text-kakao-ink dark:text-kakao-ink bg-kakao hover:bg-kakao-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-kakao-ink transition-colors duration-200 font-title touch-manipulation"
          >
            <MessageCircle className="mr-2" size={18} aria-hidden="true" />
            {t('contact.form.kakao')}
          </m.a>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {t('actions.responseAssurance', { defaultValue: '보통 24시간 이내 답변 · 당일 예약도 가능합니다' })}
          </p>
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
};

export default ContactFormCard;
