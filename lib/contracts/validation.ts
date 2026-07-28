import validator from 'validator';

export interface CreateContractPayload {
  title: string;
  customerName: string;
  customerBirthdate?: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string;
  roomNumber: string;
  roomArea?: string;
  /** ISO 8601 또는 YYYY-MM-DD */
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  paymentDay?: number;
  specialTerms?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; data: CreateContractPayload }
  | { ok: false; errors: ValidationError[] };

const MAX_TITLE_LENGTH = 120;
const MAX_NAME_LENGTH = 60;
const MAX_ADDRESS_LENGTH = 200;
const MAX_SPECIAL_TERMS = 10;
const MAX_SPECIAL_TERM_LENGTH = 500;
/** 실수로 0을 하나 더 붙이는 입력을 막는 상한 (월 1,000만원) */
const MAX_AMOUNT = 10_000_000;

const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * 한 줄 입력에 섞이면 안 되는 문자.
 *
 * 줄바꿈은 계약서 표의 셀 안에서 <br>로 살아남아, 이름 한 칸에 "홍길동 / 보증금 면제
 * 확정" 같은 문구를 두 줄로 심을 수 있다(파이프를 막아도 남는 우회 경로). 제로폭
 * 문자는 눈에 보이지 않아 동명이인 위장에 쓰이고, 그 밖의 제어문자는 이메일 제목과
 * 로그를 깨뜨린다.
 *
 * 방향 제어는 embedding·override(202A–202E)만으로 부족하다. isolate(2066–2069)로도
 * 표시 순서를 뒤집을 수 있어, 화면과 PDF에 보이는 글자가 저장된 값과 달라진다
 * (Trojan Source). 계약서는 "보이는 대로 합의한 것"이 되어야 하므로 방향을 건드리는
 * 문자는 모두 막는다.
 */
const CONTROL_CHARS =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]/;

export const validateCreateContractPayload = (
  payload: Record<string, unknown>,
): ValidationResult => {
  const errors: ValidationError[] = [];
  const push = (field: string, message: string) => errors.push({ field, message });

  const readString = (field: string, maxLength: number, required = true): string | undefined => {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim() === '') {
      if (required) push(field, '필수 항목입니다.');
      return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      push(field, `${maxLength}자 이내로 입력해 주세요.`);
      return undefined;
    }
    if (CONTROL_CHARS.test(trimmed)) {
      push(field, '줄바꿈이나 보이지 않는 문자는 사용할 수 없습니다.');
      return undefined;
    }
    return trimmed;
  };

  const title = readString('title', MAX_TITLE_LENGTH);
  const customerName = readString('customerName', MAX_NAME_LENGTH);
  const customerEmail = readString('customerEmail', MAX_NAME_LENGTH * 2);
  const customerPhone = readString('customerPhone', 32);
  const roomNumber = readString('roomNumber', 20);
  const startDateRaw = readString('startDate', 40);
  const endDateRaw = readString('endDate', 40);

  const customerBirthdate = readString('customerBirthdate', 20, false);
  const customerAddress = readString('customerAddress', MAX_ADDRESS_LENGTH, false);
  const roomArea = readString('roomArea', 60, false);

  if (customerEmail && !validator.isEmail(customerEmail)) {
    push('customerEmail', '올바른 이메일 주소가 아닙니다.');
  }

  if (customerPhone && !validator.isMobilePhone(customerPhone, 'ko-KR')) {
    push('customerPhone', '올바른 휴대폰 번호가 아닙니다. (예: 010-1234-5678)');
  }

  if (customerBirthdate && !validator.isDate(customerBirthdate, { format: 'YYYY-MM-DD' })) {
    push('customerBirthdate', 'YYYY-MM-DD 형식으로 입력해 주세요.');
  }

  const startDate = startDateRaw ? parseDate(startDateRaw) : null;
  const endDate = endDateRaw ? parseDate(endDateRaw) : null;

  if (startDateRaw && !startDate) push('startDate', '올바른 날짜가 아닙니다.');
  if (endDateRaw && !endDate) push('endDate', '올바른 날짜가 아닙니다.');
  if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
    push('endDate', '종료일은 시작일보다 뒤여야 합니다.');
  }

  const readAmount = (field: string, allowZero: boolean): number | undefined => {
    const value = payload[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      push(field, '숫자를 입력해 주세요.');
      return undefined;
    }
    if (!Number.isInteger(value)) {
      push(field, '원 단위 정수로 입력해 주세요.');
      return undefined;
    }
    if (allowZero ? value < 0 : value <= 0) {
      push(field, allowZero ? '0 이상이어야 합니다.' : '0보다 커야 합니다.');
      return undefined;
    }
    if (value > MAX_AMOUNT) {
      push(field, `${MAX_AMOUNT.toLocaleString('ko-KR')}원을 넘을 수 없습니다.`);
      return undefined;
    }
    return value;
  };

  const monthlyRent = readAmount('monthlyRent', false);
  const depositAmount = readAmount('depositAmount', true);

  let paymentDay: number | undefined;
  if (payload.paymentDay !== undefined && payload.paymentDay !== null) {
    const value = payload.paymentDay;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 31) {
      push('paymentDay', '1일부터 31일 사이로 입력해 주세요.');
    } else {
      paymentDay = value;
    }
  }

  let specialTerms: string[] | undefined;
  if (payload.specialTerms !== undefined && payload.specialTerms !== null) {
    if (!Array.isArray(payload.specialTerms)) {
      push('specialTerms', '특약사항 형식이 올바르지 않습니다.');
    } else {
      const terms = payload.specialTerms
        .filter((term): term is string => typeof term === 'string')
        .map((term) => term.trim())
        .filter((term) => term !== '');

      if (terms.length > MAX_SPECIAL_TERMS) {
        push('specialTerms', `특약사항은 최대 ${MAX_SPECIAL_TERMS}개까지 입력할 수 있습니다.`);
      } else if (terms.some((term) => term.length > MAX_SPECIAL_TERM_LENGTH)) {
        push('specialTerms', `각 특약사항은 ${MAX_SPECIAL_TERM_LENGTH}자 이내로 입력해 주세요.`);
      } else if (terms.some((term) => CONTROL_CHARS.test(term))) {
        // 특약도 계약서 표의 한 칸에 들어간다 — 다른 한 줄 입력과 같은 규칙을 적용한다.
        push('specialTerms', '줄바꿈이나 보이지 않는 문자는 사용할 수 없습니다.');
      } else if (terms.length > 0) {
        specialTerms = terms;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title: title as string,
      customerName: customerName as string,
      customerBirthdate,
      customerEmail: customerEmail as string,
      customerPhone: customerPhone as string,
      customerAddress,
      roomNumber: roomNumber as string,
      roomArea,
      startDate: startDateRaw as string,
      endDate: endDateRaw as string,
      monthlyRent: monthlyRent as number,
      depositAmount: depositAmount as number,
      paymentDay,
      specialTerms,
    },
  };
};
