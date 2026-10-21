import { LESSON_MONTHLY_PRICE } from '../../../data/pricing';
import { BANK_ACCOUNT } from '../../payments/bankAccount';

/**
 * 프로듀싱 레슨 수강 계약의 조건 — 계약마다 굳혀 `lesson_contracts.terms_json`에 둔다(음원 제작 계약과 같은 이유: 정본 상수가 바뀌어도
 * 이미 맺은 계약의 약속은 그대로여야 한다). 템플릿은 이 값을 본문에 찍기만 한다.
 *
 * 금액은 **월 수강료(공급가, 부가세 별도)** 하나가 정본이다. 카드는 부가세 10%를 더해 청구하고, 계좌·현금은 부가세를 받지 않는다(data/pricing.ts 안내).
 * 월 4회를 한 달로 센다 — 12주 = 3개월, 24주 = 6개월.
 */

export const LESSON_TERMS_VERSION = 1;
export type LessonPayMethod = 'card' | 'bank' | 'cash';

export interface LessonContractTerms {
  version: typeof LESSON_TERMS_VERSION;
  courseWeeks: 12 | 24;
  /** 첫 수업 날짜(KST)와 시각('HH:MM'), 수업 시간(분). 요일은 첫 수업일로 정해진다. */
  startDate: string;
  startTime: string;
  durationMin: number;
  /** 월 수강료(공급가). */
  monthlyAmount: number;
  payMethod: LessonPayMethod;
  /** 계좌 선불일 때 입금 계좌(계약 시점 값을 굳힌다). */
  bank: { name: string; account: string; holder: string };
}

export interface LessonTermsSource {
  courseWeeks: number;
  startDate: string;
  startTime: string;
  durationMin: number;
  monthlyAmount: number;
  payMethod: string;
}

export const buildLessonTerms = (source: LessonTermsSource): LessonContractTerms => {
  if (source.courseWeeks !== 12 && source.courseWeeks !== 24) throw new Error('과정은 12주 또는 24주예요.');
  if (source.payMethod !== 'card' && source.payMethod !== 'bank' && source.payMethod !== 'cash') throw new Error('결제 방식이 올바르지 않아요.');
  return {
    version: LESSON_TERMS_VERSION,
    courseWeeks: source.courseWeeks,
    startDate: source.startDate,
    startTime: source.startTime,
    durationMin: source.durationMin,
    monthlyAmount: source.monthlyAmount > 0 ? source.monthlyAmount : LESSON_MONTHLY_PRICE,
    payMethod: source.payMethod,
    bank: { name: BANK_ACCOUNT.bankName, account: BANK_ACCOUNT.accountNumber, holder: BANK_ACCOUNT.accountHolder },
  };
};

/** 키 순서를 고정해 같은 조건이면 같은 문자열이 되게 한다(지문이 이 문자열을 덮는다). */
export const canonicalLessonTermsJson = (t: LessonContractTerms): string =>
  JSON.stringify({
    version: t.version, courseWeeks: t.courseWeeks, startDate: t.startDate, startTime: t.startTime, durationMin: t.durationMin,
    monthlyAmount: t.monthlyAmount, payMethod: t.payMethod, bank: { name: t.bank.name, account: t.bank.account, holder: t.bank.holder },
  });

const isTerms = (v: unknown): v is LessonContractTerms => {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  const bank = t.bank as Record<string, unknown> | undefined;
  return t.version === LESSON_TERMS_VERSION && (t.courseWeeks === 12 || t.courseWeeks === 24)
    && typeof t.startDate === 'string' && typeof t.startTime === 'string' && typeof t.durationMin === 'number'
    && typeof t.monthlyAmount === 'number' && (t.payMethod === 'card' || t.payMethod === 'bank' || t.payMethod === 'cash')
    && typeof bank === 'object' && bank !== null && typeof bank.name === 'string' && typeof bank.account === 'string' && typeof bank.holder === 'string';
};

/** 저장된 조건을 읽는다. 읽지 못하면 던진다 — 조건을 모른 채 계약을 다루면 안 된다. */
export const parseLessonTerms = (raw: string): LessonContractTerms => {
  const parsed: unknown = JSON.parse(raw);
  if (!isTerms(parsed)) throw new Error('수강 계약의 조건을 읽을 수 없습니다.');
  return parsed;
};

/** 월 수 — 월 4회 기준. */
export const courseMonths = (t: Pick<LessonContractTerms, 'courseWeeks'>): number => t.courseWeeks / 4;

/** 카드 청구액 = 공급가 + 부가세 10%(구독 청구와 같은 규칙, lib/billing/amounts.ts). */
export const cardMonthlyAmount = (t: Pick<LessonContractTerms, 'monthlyAmount'>): number => Math.round(t.monthlyAmount * 1.1);

export const PAY_METHOD_NAME: Record<LessonPayMethod, string> = { card: '카드 정기결제', bank: '계좌 선불', cash: '현금 선불' };

/** 계약서 이름 — 메일 제목·화면에 쓴다. */
export const LESSON_CONTRACT_NAME = '프로듀싱 레슨 수강 계약서';
