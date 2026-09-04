import validator from 'validator';

import {
  getFirstContactValidationError,
  toContactFormFields,
  validateContactForm,
  type ContactValidationCode,
} from '../../utils/contactValidation';

export interface SanitizedContactPayload {
  name: string;
  phone: string;
  email: string;
  message: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
}

const validationCodeMessageMap: Record<ContactValidationCode, string> = {
  name_required: 'Name is required',
  name_min: 'Name must be 2-100 characters',
  name_max: 'Name must be 2-100 characters',
  name_invalid: 'Name contains invalid characters',
  email_required: 'Valid email is required',
  email_invalid: 'Valid email is required',
  email_max: 'Email must not exceed 254 characters',
  phone_required: 'Phone is required',
  phone_invalid: 'Phone contains invalid characters',
  phone_length: 'Phone must be 5-50 characters',
  message_required: 'Message is required',
  message_min: 'Message must be 10-5000 characters',
  message_max: 'Message must be 10-5000 characters',
};

const MIN_FILL_MS = 3000;

const toSafeOptionalString = (value: unknown, maxLength = 255): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
};

export const isHoneypotSubmission = (company: unknown): boolean =>
  typeof company === 'string' && company.trim().length > 0;

/**
 * 봇 시간 트랩 — 폼을 채운 **경과 시간**(클라이언트가 계산)으로 판정한다.
 *
 * 예전엔 클라이언트의 절대 시각(`_formLoadTime`)을 받아 `Date.now()(서버) - 그 값`을
 * 뺐다. 두 시계가 다른 기계라 **방문자 PC 시계가 3초만 빨라도** 정상 제출이 봇으로
 * 찍혔고, 호출부가 그 경우 200 성공을 돌려주므로(봇에게 실패를 알리지 않으려는 설계)
 * 문의가 화면상 "전송 완료"인 채로 조용히 사라졌다. NTP 미동기는 흔하고, 그 사람은
 * 몇 번을 다시 보내도 영원히 같은 결과를 받는다.
 *
 * 경과 시간은 한 시계 안에서만 빼므로 스큐가 소거된다. 봇 차단력은 그대로다 —
 * 값을 위조하려면 어차피 스크립트를 고쳐야 하고, 그건 절대 시각도 마찬가지였다.
 */
export const isTooFast = (formFillMs: unknown): boolean => {
  if (typeof formFillMs !== 'number' || !Number.isFinite(formFillMs)) return false;
  // 음수는 조작이거나 계산 오류다. 정상 사용자를 버리지 않도록 통과시킨다(honeypot이 남아 있다).
  if (formFillMs < 0) return false;
  return formFillMs < MIN_FILL_MS;
};

export const validateAndSanitizeContactPayload = (
  payload: Record<string, unknown>
): {
  validationError?: { field: string; code: ContactValidationCode; message: string };
  sanitized?: SanitizedContactPayload;
} => {
  const contactFields = toContactFormFields({
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    message: payload.message,
  });
  const validationResult = validateContactForm(contactFields);
  const firstValidationError = getFirstContactValidationError(validationResult.errors);

  if (firstValidationError) {
    return {
      validationError: {
        field: firstValidationError.field,
        code: firstValidationError.code,
        message: validationCodeMessageMap[firstValidationError.code],
      },
    };
  }

  return {
    sanitized: {
      name: validationResult.normalized.name,
      email: validator.normalizeEmail(validationResult.normalized.email) || validationResult.normalized.email,
      message: validationResult.normalized.message,
      phone: validationResult.normalized.phone,
      utm_source: toSafeOptionalString(payload.utm_source),
      utm_medium: toSafeOptionalString(payload.utm_medium),
      utm_campaign: toSafeOptionalString(payload.utm_campaign),
      referrer: toSafeOptionalString(payload.referrer, 2048),
    },
  };
};
