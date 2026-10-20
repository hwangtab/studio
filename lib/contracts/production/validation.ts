import validator from 'validator';

import { CONTROL_CHARS, type ValidationError } from '../validation';
import { SONG_COUNT_RANGE, validateProductionTerms, type ProductionKind, type ProductionTerms } from './terms';

/**
 * 관리자가 제작 계약을 만들거나 고칠 때 보내는 값.
 *
 * 생년월일·주소는 받지 않는다 — 연습실과 같이 서명자가 서명 화면에서 직접 채운다
 * (lib/contracts/validation.ts validateSignerDetails 주석). API로 들어와도 무시한다.
 */
/** 미성년 의뢰인의 법정대리인. 운영자가 계약을 만들 때 적는다(대리인에게 따로 서명 링크가 간다). */
export interface GuardianInput {
  name: string;
  relation: string;
  email: string;
  phone: string;
}

export interface ProductionContractPayload {
  /** 싱글·EP·정규 — 계약서 문안과 곡 수 범위를 고른다. */
  kind: ProductionKind;
  title: string;
  clientName: string;
  clientStageName: string | null;
  clientEmail: string;
  clientPhone: string;
  /** 있으면 의뢰인이 미성년이어도 서명할 수 있고, 대리인 서명까지 끝나야 계약이 성립한다(계약서 제14조). */
  guardian: GuardianInput | null;
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

  /**
   * 법정대리인. 값이 오면 네 칸을 모두 받는다 — 연락처는 대리인의 본인 확인 기준이고, 의뢰인과 같은 번호면
   * 뒷자리 확인이 서로를 구별하지 못하므로 막는다.
   */
  let guardian: GuardianInput | null = null;
  const rawGuardian = payload.guardian;
  if (rawGuardian !== undefined && rawGuardian !== null) {
    if (typeof rawGuardian !== 'object' || Array.isArray(rawGuardian)) {
      push('guardian', '법정대리인 정보 형식이 올바르지 않습니다.');
    } else {
      const g = rawGuardian as Record<string, unknown>;
      const read = (key: keyof GuardianInput, max: number): string | null => {
        const value = g[key];
        const field = `guardian.${key}`;
        if (typeof value !== 'string' || value.trim() === '') {
          push(field, '필수 항목입니다.');
          return null;
        }
        const trimmed = value.trim();
        if (trimmed.length > max) {
          push(field, `${max}자 이내로 입력해 주세요.`);
          return null;
        }
        if (CONTROL_CHARS.test(trimmed)) {
          push(field, '줄바꿈이나 보이지 않는 문자는 사용할 수 없습니다.');
          return null;
        }
        return trimmed;
      };
      const name = read('name', MAX_NAME_LENGTH);
      const relation = read('relation', 20);
      const email = read('email', MAX_NAME_LENGTH * 2);
      const phone = read('phone', 32);
      if (email && !validator.isEmail(email)) push('guardian.email', '올바른 이메일 주소가 아닙니다.');
      if (phone && !validator.isMobilePhone(phone, 'ko-KR')) push('guardian.phone', '올바른 휴대폰 번호가 아닙니다.');
      if (phone && clientPhone && phone.replace(/\D/g, '') === clientPhone.replace(/\D/g, '')) {
        push('guardian.phone', '의뢰인과 다른 번호여야 합니다 — 각자 자기 번호로 본인 확인을 합니다.');
      }
      if (email && clientEmail && email.toLowerCase() === clientEmail.toLowerCase()) {
        push('guardian.email', '의뢰인과 다른 이메일이어야 합니다 — 법정대리인 서명 링크는 대리인에게만 가야 합니다.');
      }
      if (name && relation && email && phone) guardian = { name, relation, email, phone };
    }
  }

  // 종류를 모르면 곡 수를 검증할 수 없다. 값이 없으면 싱글(1단계 API 호환).
  const kind = (payload.kind ?? 'single') as ProductionKind;
  const knownKind = Object.prototype.hasOwnProperty.call(SONG_COUNT_RANGE, kind);
  if (!knownKind) push('kind', '계약 종류(싱글·EP·정규·믹싱·마스터링)를 골라 주세요.');
  const terms = validateProductionTerms(payload.terms, knownKind ? kind : 'single');
  if (!terms.ok) errors.push(...terms.errors);

  if (errors.length > 0 || !terms.ok) return { ok: false, errors };

  return {
    ok: true,
    data: {
      kind,
      title: title as string,
      clientName: clientName as string,
      clientStageName,
      clientEmail: clientEmail as string,
      clientPhone: clientPhone as string,
      guardian,
      terms: terms.data,
    },
  };
};
