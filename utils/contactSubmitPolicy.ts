import type { ContactSubmitErrorMessages } from './contactMessages';
import type { ContactField } from './contactValidation';

export interface ContactResponseBody {
  success?: boolean;
  message?: string;
  field?: string;
  code?: string;
}

export interface ContactSubmitStatusRule {
  messageKey: keyof ContactSubmitErrorMessages;
  canRetry: boolean;
}

const SUBMIT_STATUS_RULES: Partial<Record<number, ContactSubmitStatusRule>> = {
  400: { messageKey: 'invalidRequest', canRetry: false },
  403: { messageKey: 'forbidden', canRetry: false },
  415: { messageKey: 'invalidRequest', canRetry: false },
  429: { messageKey: 'tooMany', canRetry: true },
  502: { messageKey: 'unavailable', canRetry: true },
  503: { messageKey: 'unavailable', canRetry: true },
  504: { messageKey: 'timeout', canRetry: true },
};

export const isContactField = (value: string): value is ContactField =>
  value === 'name' || value === 'email' || value === 'phone' || value === 'message';

export const getSubmitStatusRule = (status: number): ContactSubmitStatusRule | undefined =>
  SUBMIT_STATUS_RULES[status];

export const parseContactResponseBody = async (response: Response): Promise<ContactResponseBody> => {
  try {
    return (await response.json()) as ContactResponseBody;
  } catch {
    return {};
  }
};
