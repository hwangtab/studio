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

export const isTooFast = (formLoadTime: unknown): boolean => {
  if (typeof formLoadTime !== 'number' || !Number.isFinite(formLoadTime)) return false;
  return Date.now() - formLoadTime < MIN_FILL_MS;
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
