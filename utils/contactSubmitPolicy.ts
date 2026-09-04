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
  // 500에 규칙이 없으면 아래 폴백이 서버 원문을 그대로 띄웠다 — 한국어 사용자가
  // "Server configuration error"를 봤다. 사용자가 할 일은 502·503과 같다(잠시 후 재시도).
  500: { messageKey: 'unavailable', canRetry: true },
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
  } catch (error) {
    // 서버가 500 HTML 에러 페이지 등 JSON이 아닌 응답을 주면 여기로 떨어진다.
    // 호출부(useContactForm)는 빈 객체를 정상 빈 응답과 구분하지 않지만, 상태 코드
    // 기반 폴백(getSubmitStatusRule/제네릭 에러 메시지)이 있어 성공으로 오인하진 않는다.
    // 다만 원인 파악을 위해 최소한 로깅은 남긴다.
    console.error('[contactSubmitPolicy] Failed to parse contact response body as JSON:', error);
    return {};
  }
};
