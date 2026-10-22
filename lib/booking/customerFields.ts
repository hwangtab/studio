import isEmail from 'validator/lib/isEmail';

import { normalizeKoreanMobile } from './validation';

/**
 * 예약·믹싱 주문·결제 링크 폼의 주문자 칸 검사 — 칸마다 한국어 오류를 돌려준다.
 *
 * 예전엔 `required`만 두고 브라우저 기본 검증에 맡겨, 빈 칸은 브라우저 말풍선(기기·언어마다 문구가 다르다)이
 * 막고 "02-123"·한 글자 이름처럼 형식이 틀린 값은 그대로 서버까지 갔다가 폼 아래 오류 한 줄로 돌아왔다
 * (어느 칸이 틀렸는지 표시 없음). 규칙은 서버(`validateCustomerContact`)와 같다 — 한쪽을 바꾸면 둘 다.
 */
export type CustomerFieldKey = 'customerName' | 'customerPhone' | 'customerEmail';
export type CustomerFieldErrors = Partial<Record<CustomerFieldKey, string>>;

export const CUSTOMER_FIELD_ORDER: readonly CustomerFieldKey[] = ['customerName', 'customerPhone', 'customerEmail'];

export const validateCustomerFields = (v: Record<CustomerFieldKey, string>): CustomerFieldErrors => {
  const errors: CustomerFieldErrors = {};
  const name = v.customerName.trim();
  if (!name) errors.customerName = '이름을 입력해 주세요.';
  else if (name.length < 2) errors.customerName = '이름은 2자 이상 적어 주세요.';
  else if (name.length > 40) errors.customerName = '이름은 40자 이내로 적어 주세요.';

  const phone = v.customerPhone.trim();
  if (!phone) errors.customerPhone = '휴대폰 번호를 입력해 주세요.';
  else if (!normalizeKoreanMobile(phone)) errors.customerPhone = '휴대폰 번호를 확인해 주세요. 예: 010-1234-5678';

  const email = v.customerEmail.trim();
  if (!email) errors.customerEmail = '이메일을 입력해 주세요.';
  else if (!isEmail(email)) errors.customerEmail = '이메일 주소를 확인해 주세요. 예: name@example.com';

  return errors;
};

/** 오류가 있으면 첫 칸으로 포커스를 옮기고 true. 칸 id는 Field id(= 키)와 같다. */
export const focusFirstCustomerFieldError = (errors: CustomerFieldErrors): boolean => {
  const first = CUSTOMER_FIELD_ORDER.find((k) => errors[k]);
  if (!first) return false;
  if (typeof document !== 'undefined') document.getElementById(first)?.focus();
  return true;
};
