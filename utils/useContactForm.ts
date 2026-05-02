import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Locale } from '../lib/i18n';
import {
  getContactValidationMessage,
  getSubmitErrorMessages,
  type ContactSubmitErrorMessages,
} from './contactMessages';
import {
  getFirstContactValidationError,
  toContactFormFields,
  validateContactField,
  validateContactForm,
  type ContactField,
  type ContactValidationCode,
} from './contactValidation';
import { trackLeadEvent, type LeadEventName } from './analytics';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface ContactAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
}

interface ContactResponseBody {
  success?: boolean;
  message?: string;
  field?: string;
  code?: string;
}

export interface ContactFormData {
  name: string;
  phone: string;
  email: string;
  message: string;
  company: string;
}

type ContactErrors = Record<ContactField, string>;

interface UseContactFormParams {
  locale: Locale;
  t: TranslateFn;
}

interface UseContactFormResult {
  formData: ContactFormData;
  errors: ContactErrors;
  submitMessage: string;
  isSubmitSuccess: boolean;
  isSubmitting: boolean;
  canRetrySubmit: boolean;
  retryLabel: string;
  errorCount: number;
  handleChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (event: FormEvent) => Promise<void>;
  handleRetrySubmit: () => void;
}

const EMPTY_FORM_DATA: ContactFormData = {
  name: '',
  phone: '',
  email: '',
  message: '',
  company: '',
};

const EMPTY_ERRORS: ContactErrors = {
  name: '',
  email: '',
  phone: '',
  message: '',
};

const SUBMIT_STATUS_RULES: Partial<Record<number, { messageKey: keyof ContactSubmitErrorMessages; canRetry: boolean }>> = {
  400: { messageKey: 'invalidRequest', canRetry: false },
  403: { messageKey: 'forbidden', canRetry: false },
  415: { messageKey: 'invalidRequest', canRetry: false },
  429: { messageKey: 'tooMany', canRetry: true },
  502: { messageKey: 'unavailable', canRetry: true },
  503: { messageKey: 'unavailable', canRetry: true },
  504: { messageKey: 'timeout', canRetry: true },
};

const isContactField = (value: string): value is ContactField =>
  value === 'name' || value === 'email' || value === 'phone' || value === 'message';

const parseJsonSafe = async (response: Response): Promise<ContactResponseBody> => {
  try {
    return (await response.json()) as ContactResponseBody;
  } catch {
    return {};
  }
};

export const useContactForm = ({ locale, t }: UseContactFormParams): UseContactFormResult => {
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM_DATA);
  const [errors, setErrors] = useState<ContactErrors>(EMPTY_ERRORS);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 동기 가드: React state 업데이트는 비동기라, 빠른 더블클릭 시 두 번째 클릭이
  // setIsSubmitting(true) 반영 전 통과해 fetch가 중복 발사될 수 있음. ref로 동기 차단.
  const submittingRef = useRef(false);
  const [canRetrySubmit, setCanRetrySubmit] = useState(false);
  const [lastSubmittedData, setLastSubmittedData] = useState<ContactFormData | null>(null);
  const [attribution, setAttribution] = useState<ContactAttribution>({});
  // Funnel 추적 상태 — 세션당 한 번만 form_start, 그리고 abandon 판단에 사용.
  const [hasStartedForm, setHasStartedForm] = useState(false);

  const submitErrorCopy = useMemo(() => getSubmitErrorMessages(locale), [locale]);
  const errorCount = useMemo(() => Object.values(errors).filter(Boolean).length, [errors]);
  const trackFormEvent = useCallback(
    (
      name: LeadEventName,
      extra: Record<string, string | number | boolean | null | undefined> = {}
    ) => {
      trackLeadEvent(name, {
        locale,
        component: 'ContactForm',
        cta_id: name.startsWith('lead_submit') ? 'contact_form_submit' : 'contact_form',
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        ...extra,
      });
    },
    [attribution.utm_campaign, attribution.utm_medium, attribution.utm_source, locale]
  );
  // 기존 submit 이벤트도 동일 helper로 일원화 (시그니처 호환).
  const trackSubmitEvent = trackFormEvent;

  const getValidationMessage = useCallback(
    (code?: ContactValidationCode): string => getContactValidationMessage(code, locale, t),
    [locale, t]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    setAttribution({
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      referrer: document.referrer || undefined,
    });
  }, []);

  // 폼 이탈 추적 — pagehide(가장 안정)에서 폼 시작했으나 성공 전 떠나면 abandon 전송.
  // bfcache 상황을 고려해 beforeunload 대신 pagehide 채택.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePageHide = () => {
      if (!hasStartedForm || isSubmitSuccess) return;
      trackFormEvent('lead_form_abandon', {
        name_filled: Boolean(formData.name),
        email_filled: Boolean(formData.email),
        phone_filled: Boolean(formData.phone),
        message_filled: Boolean(formData.message),
        error_count: errorCount,
      });
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [hasStartedForm, isSubmitSuccess, formData, errorCount, trackFormEvent]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;

      // 폼 첫 입력 시점에 form_start 이벤트 (세션당 1회).
      if (!hasStartedForm && value.length > 0) {
        setHasStartedForm(true);
        trackFormEvent('lead_form_start', { first_field: name });
      }

      const nextFormData = { ...formData, [name]: value };
      setFormData(nextFormData);

      if (isContactField(name)) {
        const code = validateContactField(name, toContactFormFields(nextFormData));
        const nextMessage = getValidationMessage(code);
        setErrors((prev) => {
          const prevMessage = prev[name];
          // 신규 에러가 발생했거나 에러 종류가 변경된 경우에만 이벤트 전송
          // (같은 에러 지속 중 입력 이어갈 때 반복 발사 방지).
          if (nextMessage && nextMessage !== prevMessage) {
            trackFormEvent('lead_form_field_error', {
              field: name,
              error_code: code,
            });
          }
          return { ...prev, [name]: nextMessage };
        });
      }
    },
    [formData, getValidationMessage, hasStartedForm, trackFormEvent]
  );

  const submitWithPayload = useCallback(
    async (payload: ContactFormData) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch('/api/contact/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...payload, ...attribution }),
          signal: controller.signal,
        });

        const result = await parseJsonSafe(response);

        if (response.ok && result.success) {
          setSubmitMessage(t('contact.form.success'));
          setIsSubmitSuccess(true);
          setFormData(EMPTY_FORM_DATA);
          setErrors(EMPTY_ERRORS);
          setCanRetrySubmit(false);
          setLastSubmittedData(null);
          trackSubmitEvent('lead_submit_success');
          return;
        }

        if (response.status === 400 && typeof result.field === 'string' && isContactField(result.field)) {
          const field: ContactField = result.field;
          const codeFromServer =
            typeof result.code === 'string'
              ? (result.code as ContactValidationCode)
              : validateContactField(field, toContactFormFields(payload));
          const message = getValidationMessage(codeFromServer) || submitErrorCopy.invalidRequest;

          setErrors((prev) => ({ ...prev, [field]: message }));
          document.getElementById(field)?.focus();
          setSubmitMessage('');
          setIsSubmitSuccess(false);
          setCanRetrySubmit(false);
          trackSubmitEvent('lead_submit_error', {
            error_type: 'server_validation',
            status_code: response.status,
          });
          return;
        }

        const statusRule = SUBMIT_STATUS_RULES[response.status];
        if (statusRule) {
          setSubmitMessage(submitErrorCopy[statusRule.messageKey]);
          setIsSubmitSuccess(false);
          setCanRetrySubmit(statusRule.canRetry);
          trackSubmitEvent('lead_submit_error', {
            error_type: statusRule.messageKey,
            status_code: response.status,
          });
          return;
        }

        setSubmitMessage(result.message || t('contact.form.error'));
        setIsSubmitSuccess(false);
        setCanRetrySubmit(response.status >= 500);
        trackSubmitEvent('lead_submit_error', {
          error_type: 'unknown_status',
          status_code: response.status,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setSubmitMessage(submitErrorCopy.timeout);
          setIsSubmitSuccess(false);
          setCanRetrySubmit(true);
          trackSubmitEvent('lead_submit_error', {
            error_type: 'timeout',
          });
          return;
        }

        console.error('Error sending email:', error);
        setSubmitMessage(t('contact.form.error'));
        setIsSubmitSuccess(false);
        setCanRetrySubmit(true);
        trackSubmitEvent('lead_submit_error', {
          error_type: 'network',
        });
      } finally {
        window.clearTimeout(timeout);
        setIsSubmitting(false);
        submittingRef.current = false;
      }
    },
    [attribution, getValidationMessage, submitErrorCopy, t, trackSubmitEvent]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      const validationResult = validateContactForm(toContactFormFields(formData));
      const nextErrors: ContactErrors = {
        name: getValidationMessage(validationResult.errors.name),
        email: getValidationMessage(validationResult.errors.email),
        phone: getValidationMessage(validationResult.errors.phone),
        message: getValidationMessage(validationResult.errors.message),
      };

      setErrors(nextErrors);

      if (!validationResult.isValid) {
        const firstError = getFirstContactValidationError(validationResult.errors);
        trackSubmitEvent('lead_submit_error', {
          error_type: 'client_validation',
          first_error_field: firstError?.field || null,
        });
        if (firstError) {
          document.getElementById(firstError.field)?.focus();
        }
        return;
      }

      if (submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);
      setSubmitMessage('');
      setIsSubmitSuccess(false);
      setCanRetrySubmit(false);

      const normalizedFormData: ContactFormData = {
        ...formData,
        name: validationResult.normalized.name,
        email: validationResult.normalized.email,
        phone: validationResult.normalized.phone,
        message: validationResult.normalized.message,
      };

      setLastSubmittedData(normalizedFormData);
      await submitWithPayload(normalizedFormData);
    },
    [formData, getValidationMessage, submitWithPayload, trackSubmitEvent]
  );

  const handleRetrySubmit = useCallback(() => {
    if (!lastSubmittedData || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitMessage('');
    setIsSubmitSuccess(false);
    setCanRetrySubmit(false);
    void submitWithPayload(lastSubmittedData);
  }, [lastSubmittedData, submitWithPayload]);

  return {
    formData,
    errors,
    submitMessage,
    isSubmitSuccess,
    isSubmitting,
    canRetrySubmit,
    retryLabel: submitErrorCopy.retry,
    errorCount,
    handleChange,
    handleSubmit,
    handleRetrySubmit,
  };
};
