import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
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
  const [canRetrySubmit, setCanRetrySubmit] = useState(false);
  const [lastSubmittedData, setLastSubmittedData] = useState<ContactFormData | null>(null);
  const [attribution, setAttribution] = useState<ContactAttribution>({});

  const submitErrorCopy = useMemo(() => getSubmitErrorMessages(locale), [locale]);
  const errorCount = useMemo(() => Object.values(errors).filter(Boolean).length, [errors]);

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

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      const nextFormData = { ...formData, [name]: value };
      setFormData(nextFormData);

      if (isContactField(name)) {
        const code = validateContactField(name, toContactFormFields(nextFormData));
        setErrors((prev) => ({ ...prev, [name]: getValidationMessage(code) }));
      }
    },
    [formData, getValidationMessage]
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
          return;
        }

        const statusRule = SUBMIT_STATUS_RULES[response.status];
        if (statusRule) {
          setSubmitMessage(submitErrorCopy[statusRule.messageKey]);
          setIsSubmitSuccess(false);
          setCanRetrySubmit(statusRule.canRetry);
          return;
        }

        setSubmitMessage(result.message || t('contact.form.error'));
        setIsSubmitSuccess(false);
        setCanRetrySubmit(response.status >= 500);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setSubmitMessage(submitErrorCopy.timeout);
          setIsSubmitSuccess(false);
          setCanRetrySubmit(true);
          return;
        }

        console.error('Error sending email:', error);
        setSubmitMessage(t('contact.form.error'));
        setIsSubmitSuccess(false);
        setCanRetrySubmit(true);
      } finally {
        window.clearTimeout(timeout);
        setIsSubmitting(false);
      }
    },
    [attribution, getValidationMessage, submitErrorCopy, t]
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
        if (firstError) {
          document.getElementById(firstError.field)?.focus();
        }
        return;
      }

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
    [formData, getValidationMessage, submitWithPayload]
  );

  const handleRetrySubmit = useCallback(() => {
    if (!lastSubmittedData || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitMessage('');
    setIsSubmitSuccess(false);
    setCanRetrySubmit(false);
    void submitWithPayload(lastSubmittedData);
  }, [isSubmitting, lastSubmittedData, submitWithPayload]);

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
