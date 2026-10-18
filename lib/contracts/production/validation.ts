import validator from 'validator';

import { CONTROL_CHARS, type ValidationError } from '../validation';
import { validateProductionTerms, type ProductionTerms } from './terms';

/**
 * 관리자가 제작 계약을 만들거나 고칠 때 보내는 값.
 *
 * 생년월일·주소는 받지 않는다 — 연습실과 같이 서명자가 서명 화면에서 직접 채운다
 * (lib/contracts/validation.ts validateSignerDetails 주석). API로 들어와도 무시한다.
 */
export interface ProductionContractPayload {
  title: string;
  clientName: string;
  clientStageName: string | null;
  clientEmail: string;
  clientPhone: string;
  terms: ProductionTerms;
}

export type ProductionPayloadValidation =
  | { ok: true; data: ProductionContractPayload }
  | { ok: false; errors: ValidationError[] };

const MAX_TITLE_LENGTH = 120;
const MAX_NAME_LENGTH = 60;

export const validateProductionContractPayload = (
  payload: Record<string, unknown>,
): ProductionPayloadValidation => {
  const errors: ValidationError[] = [];
  const push = (field: string, message: string) => errors.push({ field, message });

  const readString = (field: string, maxLength: number, required = true): string | null => {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim() === '') {
      if (required) push(field, '필수 항목입니다.');
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      push(field, `${maxLength}자 이내로 입력해 주세요.`);
      return null;
    }
    if (CONTROL_CHARS.test(trimmed)) {
      push(field, '줄바꿈이나 보이지 않는 문자는 사용할 수 없습니다.');
      return null;
    }
    return trimmed;
  };

  const title = readString('title', MAX_TITLE_LENGTH);
  const clientName = readString('clientName', MAX_NAME_LENGTH);
  const clientStageName = readString('clientStageName', MAX_NAME_LENGTH, false);
  const clientEmail = readString('clientEmail', MAX_NAME_LENGTH * 2);
  const clientPhone = readString('clientPhone', 32);

  if (clientEmail && !validator.isEmail(clientEmail)) {
    push('clientEmail', '올바른 이메일 주소가 아닙니다.');
  }
  // 뒷자리가 본인 확인에 쓰이므로 휴대폰 번호만 받는다(연습실과 같은 규칙).
  if (clientPhone && !validator.isMobilePhone(clientPhone, 'ko-KR')) {
    push('clientPhone', '올바른 휴대폰 번호가 아닙니다. (예: 010-1234-5678)');
  }

  const terms = validateProductionTerms(payload.terms);
  if (!terms.ok) errors.push(...terms.errors);

  if (errors.length > 0 || !terms.ok) return { ok: false, errors };

  return {
    ok: true,
    data: {
      title: title as string,
      clientName: clientName as string,
      clientStageName,
      clientEmail: clientEmail as string,
      clientPhone: clientPhone as string,
      terms: terms.data,
    },
  };
};
