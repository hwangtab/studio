import type { ContactField, ContactReason, PhoneRule } from './rules';

/** 결제 화면 칸 아래에 붙는 문구. 서버 응답 문구(lib/booking/validation.ts 등)와는 따로 둔다 — 판정만 같다. */
export type ContactLocale = 'ko' | 'en';

const KO: Record<ContactField, Record<ContactReason, string>> = {
  customerName: { missing: '이름을 입력해 주세요.', invalid: '이름은 2~40자로 적어 주세요.' },
  customerPhone: { missing: '휴대폰 번호를 입력해 주세요.', invalid: '휴대폰 번호를 확인해 주세요. 예: 010-1234-5678' },
  customerEmail: { missing: '이메일을 입력해 주세요.', invalid: '이메일 주소를 확인해 주세요. 예: name@example.com' },
};

const EN: Record<ContactField, Record<ContactReason, string>> = {
  customerName: { missing: 'Please enter your name.', invalid: 'Your name should be 2–40 characters.' },
  customerPhone: { missing: 'Please enter your phone number.', invalid: 'Please check your phone number. Use a Korean mobile number or include the country code (e.g. +1 …).' },
  customerEmail: { missing: 'Please enter your email address.', invalid: 'Please check your email address. e.g. name@example.com' },
};

export const contactErrorCopy = (field: ContactField, reason: ContactReason, locale: ContactLocale = 'ko', rule: PhoneRule = 'kr-mobile'): string => {
  if (locale === 'en') return EN[field][reason];
  if (field === 'customerPhone' && reason === 'invalid' && rule === 'kr-or-intl') {
    return '휴대폰 번호를 확인해 주세요. 해외 번호는 국가번호(+)부터 적어 주세요.';
  }
  return KO[field][reason];
};

/** 오류 요약 한 줄 — 스크린리더가 칸 오류 여러 개를 연달아(또는 마지막만) 읽지 않게 이것 하나만 알린다. */
export const contactSummaryCopy = (count: number, locale: ContactLocale = 'ko'): string =>
  locale === 'en'
    ? `Please check ${count} ${count === 1 ? 'field' : 'fields'} below.`
    : `아래 ${count}개 항목을 확인해 주세요.`;
