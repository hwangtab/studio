import validator from 'validator';

import type { ProductionContract } from '../../../db/schema';
import { CONTROL_CHARS, type ValidationError } from '../validation';

/**
 * 링크 계약 — 운영자가 의뢰인 이름·연락처를 모르는 채 만들고, 서명 링크를 카카오톡으로 건네는 제작 계약.
 *
 * 의뢰인 칸(이름·이메일·연락처)은 빈 문자열로 저장된다(컬럼이 NOT NULL이라 null 대신). 서명 화면에서 의뢰인이
 * 직접 채우고, 서명 쓰기(sign-transaction.ts)가 계약 행과 의뢰인 서명자 행에 함께 적는다. 성립 단계는 그 값으로
 * 본문을 완성하므로, 서명본에는 의뢰인이 적은 이름·연락처가 들어간다.
 *
 * 본인 확인: 연락처 뒷자리 대조를 하지 않는다 — 비교할 번호가 없다. 링크를 1:1로 받은 사람이 서명자라는 것이
 * 전제다(카카오톡 대화방). 감사 기록(서명 일시·IP·브라우저)은 같게 남는다.
 */
export const isOpenProductionContract = (contract: Pick<ProductionContract, 'clientPhone'>): boolean =>
  contract.clientPhone.trim() === '';

/** 서명자 동의 기록(agreed_clauses)에 남기는 "본인이 계약 당사자임을 확인" 체크의 키. 조항 키와 겹치지 않는다. */
export const IDENTITY_CONFIRMED_KEY = 'identity-confirmed';

export interface OpenLinkClientInput {
  clientName: string;
  clientStageName: string | null;
  clientEmail: string;
  clientPhone: string;
}

const MAX_NAME_LENGTH = 60;

/** 이메일을 가려 보인다 — ab***@gmail.com. 완료 화면이 "어느 주소로 보냈는지"를 알리되 주소 전체를 HTML에 싣지 않는다. */
export const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email ? '***' : '';
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
};

/** 휴대폰 번호를 010-1234-5678 꼴로 — 하이픈 없이 적어도 계약서에 같은 모양으로 인쇄되게. 모양이 다르면 그대로 둔다. */
export const normalizeMobile = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (/^01\d{8,9}$/.test(digits)) return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return phone;
};

/** 서명 화면에서 의뢰인이 채운 이름·활동명·이메일·연락처. 관리자 작성 폼과 같은 규칙(validation.ts). */
export const validateOpenLinkClient = (
  raw: Record<string, unknown>,
): { ok: true; data: OpenLinkClientInput } | { ok: false; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const read = (field: keyof OpenLinkClientInput, maxLength: number, required: boolean): string | null => {
    const value = raw[field];
    if (typeof value !== 'string' || value.trim() === '') {
      if (required) errors.push({ field, message: '필수 항목입니다.' });
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      errors.push({ field, message: `${maxLength}자 이내로 입력해 주세요.` });
      return null;
    }
    if (CONTROL_CHARS.test(trimmed)) {
      errors.push({ field, message: '줄바꿈이나 보이지 않는 문자는 사용할 수 없습니다.' });
      return null;
    }
    return trimmed;
  };
  const clientName = read('clientName', MAX_NAME_LENGTH, true);
  const clientStageName = read('clientStageName', MAX_NAME_LENGTH, false);
  const clientEmail = read('clientEmail', MAX_NAME_LENGTH * 2, true);
  const clientPhone = read('clientPhone', 32, true);
  if (clientEmail && !validator.isEmail(clientEmail)) errors.push({ field: 'clientEmail', message: '올바른 이메일 주소가 아닙니다.' });
  if (clientPhone && !validator.isMobilePhone(clientPhone, 'ko-KR')) {
    errors.push({ field: 'clientPhone', message: '올바른 휴대폰 번호가 아닙니다. (예: 010-1234-5678)' });
  }
  if (errors.length > 0 || !clientName || !clientEmail || !clientPhone) return { ok: false, errors };
  return { ok: true, data: { clientName, clientStageName, clientEmail: clientEmail.toLowerCase(), clientPhone: normalizeMobile(clientPhone) } };
};
