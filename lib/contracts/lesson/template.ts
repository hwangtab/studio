import { readFileSync } from 'node:fs';
import path from 'node:path';

import { weekdayOf, WEEKDAY_LABELS } from '../../lessons/rules';
import { formatCurrency, formatDate } from '../format';
import { escapeTableCell } from '../html-escape';
import { fillPlaceholders } from '../placeholders';
import { DRAFT_CONTRACT_DATE_TEXT } from '../template';
import { cardMonthlyAmount, courseMonths, PAY_METHOD_NAME, type LessonContractTerms } from './terms';

/**
 * 수강 계약서 본문 만들기. 음원 제작 계약과 같은 규칙 — 사용자 값은 표 셀 이스케이프, 치환은 한 번에(넣은 값 안의 `{{…}}`가 다시 풀리지 않게),
 * 날짜·금액은 format.ts 한 곳에서. 템플릿 파일은 배포 파일 트레이싱에 걸려 있어야 한다(next.config.mjs outputFileTracingIncludes).
 */

/** 확정 전 문안에 붙는 표시 — 이 표시가 남은 본문은 **발송하지 않는다**(draft-guard.ts). */
export const DRAFT_MARKER = '【확정 전 초안';

export const readLessonTemplate = (): string => readFileSync(path.join(process.cwd(), 'lib/contracts/lesson/lesson-template.md'), 'utf8');

export interface LessonTemplateData {
  studentName: string;
  studentPhone: string;
  studentBirthdate?: string | null;
  studentAddress?: string | null;
  terms: LessonContractTerms;
  /** 서명 전에는 null — 계약일은 서명하는 날이다. */
  contractDate: Date | null;
}

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const paymentTerms = (t: LessonContractTerms): string => {
  const won = formatCurrency;
  if (t.payMethod === 'card') {
    return `수강생은 스튜디오가 안내하는 주소에서 카드를 등록하고, 매월 정기결제일에 ${won(cardMonthlyAmount(t))}원(부가세 10% 포함)이 자동으로 결제된다.`;
  }
  const how = t.payMethod === 'bank'
    ? `${escapeTableCell(t.bank.name)} ${escapeTableCell(t.bank.account)}(예금주 ${escapeTableCell(t.bank.holder)})로 입금`
    : '현금으로 지급';
  return `수강생은 각 월의 첫 수업일 전까지 그 달 수강료 ${won(t.monthlyAmount)}원을 ${how}한다(계좌 입금·현금은 부가세를 받지 않는다). 과정 전체(${courseMonths(t)}개월 ${won(t.monthlyAmount * courseMonths(t))}원)를 한 번에 선납해도 된다.`;
};

export const buildLessonContent = (data: LessonTemplateData, template: string): string => {
  const t = data.terms;
  const cell = (value: string | null | undefined, fallback = '') => (value ? escapeTableCell(value) : fallback);
  const months = courseMonths(t);
  return fillPlaceholders(template, {
    studentName: cell(data.studentName),
    studentPhone: cell(data.studentPhone),
    studentBirthdate: cell(data.studentBirthdate),
    studentAddress: cell(data.studentAddress),
    courseWeeks: String(t.courseWeeks),
    sessionCount: String(t.courseWeeks),
    courseMonths: String(months),
    durationMin: String(t.durationMin),
    weekdayLabel: WEEKDAY_LABELS[weekdayOf(t.startDate)],
    startDate: formatDate(new Date(`${t.startDate}T00:00:00+09:00`)),
    startTime: t.startTime,
    endTime: addMinutes(t.startTime, t.durationMin),
    monthlyAmount: formatCurrency(t.monthlyAmount),
    totalAmount: formatCurrency(t.monthlyAmount * months),
    payMethodName: PAY_METHOD_NAME[t.payMethod],
    paymentTerms: paymentTerms(t),
    contractDate: data.contractDate === null ? DRAFT_CONTRACT_DATE_TEXT : formatDate(data.contractDate),
  });
};

/** 템플릿에 남은 자리표시자. 테스트가 "모든 변수가 채워졌다"를 확인하는 데 쓴다. */
export const findUnfilledPlaceholders = (content: string): string[] => content.match(/\{\{[a-zA-Z]+\}\}/g) ?? [];

/** 본문에 확정 전 표시가 남아 있는가 — 남아 있으면 발송을 막는다. */
export const hasDraftMarker = (content: string): boolean => content.includes(DRAFT_MARKER);
