export type ContactField = 'name' | 'email' | 'phone' | 'message';

export type ContactValidationCode =
  | 'name_required'
  | 'name_min'
  | 'name_max'
  | 'name_invalid'
  | 'email_required'
  | 'email_invalid'
  | 'email_max'
  | 'phone_required'
  | 'phone_invalid'
  | 'phone_length'
  | 'message_required'
  | 'message_min'
  | 'message_max';

export interface ContactFormFields {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export interface ContactValidationResult {
  normalized: ContactFormFields;
  errors: Partial<Record<ContactField, ContactValidationCode>>;
  isValid: boolean;
}

export const CONTACT_LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  phone: { min: 5, max: 50 },
  message: { min: 10, max: 5000 },
} as const;

const NAME_PATTERN = /^[\p{L}\p{M}\s'-]+$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s+\-\(\)]+$/;

const toStringValue = (value: unknown): string => (typeof value === 'string' ? value : '');

export const toContactFormFields = (input: Partial<Record<ContactField, unknown>>): ContactFormFields => ({
  name: toStringValue(input.name),
  email: toStringValue(input.email),
  phone: toStringValue(input.phone),
  message: toStringValue(input.message),
});

export const validateContactForm = (fields: ContactFormFields): ContactValidationResult => {
  const normalizedName = fields.name.trim();
  const normalizedEmail = fields.email.trim();
  const rawPhone = fields.phone;
  const normalizedPhone = rawPhone.replace(/\s/g, '');
  const normalizedMessage = fields.message.trim();
  const errors: Partial<Record<ContactField, ContactValidationCode>> = {};

  if (!normalizedName) {
    errors.name = 'name_required';
  } else if (normalizedName.length < CONTACT_LIMITS.name.min) {
    errors.name = 'name_min';
  } else if (normalizedName.length > CONTACT_LIMITS.name.max) {
    errors.name = 'name_max';
  } else if (!NAME_PATTERN.test(normalizedName)) {
    errors.name = 'name_invalid';
  }

  if (!normalizedEmail) {
    errors.email = 'email_required';
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = 'email_invalid';
  } else if (normalizedEmail.length > CONTACT_LIMITS.email.max) {
    errors.email = 'email_max';
  }

  if (!rawPhone) {
    errors.phone = 'phone_required';
  } else if (!PHONE_PATTERN.test(rawPhone)) {
    errors.phone = 'phone_invalid';
  } else if (!normalizedPhone) {
    errors.phone = 'phone_required';
  } else if (normalizedPhone.length < CONTACT_LIMITS.phone.min || normalizedPhone.length > CONTACT_LIMITS.phone.max) {
    errors.phone = 'phone_length';
  }

  if (!normalizedMessage) {
    errors.message = 'message_required';
  } else if (normalizedMessage.length < CONTACT_LIMITS.message.min) {
    errors.message = 'message_min';
  } else if (normalizedMessage.length > CONTACT_LIMITS.message.max) {
    errors.message = 'message_max';
  }

  return {
    normalized: {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      message: normalizedMessage,
    },
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

export const validateContactField = (field: ContactField, fields: ContactFormFields): ContactValidationCode | undefined => {
  const { errors } = validateContactForm(fields);
  return errors[field];
};

export const getFirstContactValidationError = (
  errors: Partial<Record<ContactField, ContactValidationCode>>
): { field: ContactField; code: ContactValidationCode } | null => {
  const fieldOrder: ContactField[] = ['name', 'email', 'phone', 'message'];
  for (const field of fieldOrder) {
    const code = errors[field];
    if (code) {
      return { field, code };
    }
  }
  return null;
};
