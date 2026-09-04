import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Locale } from '../lib/i18n';
import {
  getContactValidationMessage,
  getSubmitErrorMessages,
} from './contactMessages';
import {
  getFirstContactValidationError,
  toContactFormFields,
  validateContactField,
  validateContactForm,
  type ContactField,
  type ContactValidationCode,
} from './contactValidation';
import {
  getSubmitStatusRule,
  isContactField,
  parseContactResponseBody,
} from './contactSubmitPolicy';
import { trackLeadEvent, type LeadEventName } from './analytics';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface ContactAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
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
  handleBlur: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
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

export const useContactForm = ({ locale, t }: UseContactFormParams): UseContactFormResult => {
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM_DATA);
  const [errors, setErrors] = useState<ContactErrors>(EMPTY_ERRORS);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 동기 가드: React state 업데이트는 비동기라, 빠른 더블클릭 시 두 번째 클릭이
  // setIsSubmitting(true) 반영 전 통과해 fetch가 중복 발사될 수 있음. ref로 동기 차단.
  const submittingRef = useRef(false);
  // 시간 트랩: 폼 마운트 시각. 제출 시 여기서 경과 시간을 계산해 보낸다(절대 시각 아님).
  const formMountTimeRef = useRef<number>(Date.now());
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

      // 입력 중에는 검증 에러를 새로 띄우지 않는다 (공격적 on-change 검증은 미완성
      // 이메일/전화 입력 도중 빨간 에러를 노출해 이탈을 유발하고 field_error 이벤트를
      // 부풀린다). 이미 떠 있는 에러가 입력으로 해소되면 즉시 해제만 한다(긍정 피드백).
      // 신규 검증·에러 표시·이벤트 발사는 handleBlur(필드 이탈 시점)에서 처리.
      if (isContactField(name) && errors[name]) {
        const code = validateContactField(name, toContactFormFields(nextFormData));
        if (!code) {
          setErrors((prev) => ({ ...prev, [name]: '' }));
        }
      }
    },
    [errors, formData, hasStartedForm, trackFormEvent]
  );

  // 검증은 필드를 떠나는 시점에만 수행 — 미완성 입력에 대한 빨간 에러를 막고,
  // field_error 이벤트는 "사용자가 잘못된 값을 남기고 떠났다"는 진짜 신호일 때만 발사.
  const handleBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      if (!isContactField(name)) return;

      // 빈 필드는 blur에서 검증하지 않는다 — 탭·클릭으로 지나가기만 해도
      // required 에러가 뜨면, 폼 위에 카톡·이메일 대안 버튼이 많아 훑어보는
      // 동선이 긴 페이지(특히 /en/contact)에서 이탈을 유발하고 field_error
      // 이벤트를 부풀린다(90일 en 필드 에러 12건 vs 제출 성공 2건).
      // required 검증은 submit 시점이 담당한다. 값을 지우고 떠난 경우엔
      // 남아 있던 형식 에러만 조용히 해제한다.
      if (!value.trim()) {
        setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
        return;
      }

      const code = validateContactField(name, toContactFormFields(formData));
      const nextMessage = getValidationMessage(code);
      setErrors((prev) => {
        if (nextMessage && nextMessage !== prev[name]) {
          trackFormEvent('lead_form_field_error', {
            field: name,
            error_code: code,
          });
        }
        return { ...prev, [name]: nextMessage };
      });
    },
    [formData, getValidationMessage, trackFormEvent]
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
          // 절대 시각이 아니라 **경과 시간**을 보낸다 — 서버가 자기 시계와 빼면 방문자 PC의
          // 시계 오차가 그대로 봇 판정에 들어가고, 그 제출은 화면상 성공인 채로 버려진다.
          body: JSON.stringify({
            ...payload,
            ...attribution,
            _formFillMs: Date.now() - formMountTimeRef.current,
          }),
          signal: controller.signal,
        });

        const result = await parseContactResponseBody(response);

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

        const statusRule = getSubmitStatusRule(response.status);
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

        // 서버 메시지를 화면에 띄우지 않는다. API가 돌려주는 문구는 영어 고정이라
        // 로케일을 무시하고, 내부 사정("Server configuration error")이 그대로 새어 나간다.
        // 필드 단위 오류는 위에서 code로 번역해 처리한다.
        setSubmitMessage(t('contact.form.error'));
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
    handleBlur,
    handleSubmit,
    handleRetrySubmit,
  };
};
