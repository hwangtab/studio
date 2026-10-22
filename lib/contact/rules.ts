import isEmail from 'validator/lib/isEmail';

import { normalizeKoreanMobile, normalizeKrOrIntlPhone } from './phone';

/**
 * 주문자 연락처(이름·휴대폰·이메일) 규칙의 **유일한 정본**. 서버 검증(예약·믹싱·결제 링크·상점·소프트웨어는
 * lib/booking/validation.ts validateCustomerContact, 공연은 lib/shows/validation.ts)과 결제 화면의 칸별 검사
 * (components/forms/useContactValidation.ts)가 같은 판정을 쓰고, 문구만 각자 고른다.
 * 예전엔 화면 쪽에 규칙 사본이 있었다(2026-10-22 리뷰) — 판정을 다시 쓰지 말고 여기를 고칠 것.
 */
export type ContactField = 'customerName' | 'customerPhone' | 'customerEmail';
export type ContactReason = 'missing' | 'invalid';
export interface ContactProblem { field: ContactField; reason: ContactReason }
export type ContactValues = Record<ContactField, string>;

/** 'kr-mobile' = 한국 휴대폰만, 'kr-or-intl' = 공연 예매(해외 번호 허용). */
export type PhoneRule = 'kr-mobile' | 'kr-or-intl';

export const CONTACT_FIELDS: readonly ContactField[] = ['customerName', 'customerPhone', 'customerEmail'];
export const CONTACT_NAME_MIN = 2;
export const CONTACT_NAME_MAX = 40;
export const CONTACT_EMAIL_MAX = 254;

export const normalizeContactPhone = (raw: string, rule: PhoneRule = 'kr-mobile'): string | null =>
  rule === 'kr-or-intl' ? normalizeKrOrIntlPhone(raw) : normalizeKoreanMobile(raw);

/** 한 칸만 본다 — 제출 뒤 입력할 때 그 칸만 다시 판정하는 데 쓴다. */
export const contactFieldProblem = (field: ContactField, raw: string, rule: PhoneRule = 'kr-mobile'): ContactReason | null => {
  const v = raw.trim();
  if (!v) return 'missing';
  switch (field) {
    case 'customerName':
      return v.length < CONTACT_NAME_MIN || v.length > CONTACT_NAME_MAX ? 'invalid' : null;
    case 'customerPhone':
      return normalizeContactPhone(v, rule) ? null : 'invalid';
    case 'customerEmail':
      return v.length > CONTACT_EMAIL_MAX || !isEmail(v) ? 'invalid' : null;
  }
};

/** 문제 있는 칸을 화면 순서(이름 → 휴대폰 → 이메일)대로. 빈 배열이면 통과. */
export const contactProblems = (values: ContactValues, rule: PhoneRule = 'kr-mobile'): ContactProblem[] =>
  CONTACT_FIELDS.flatMap((field) => {
    const reason = contactFieldProblem(field, values[field] ?? '', rule);
    return reason ? [{ field, reason }] : [];
  });
