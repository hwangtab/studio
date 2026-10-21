import type { LessonContract } from '../../../db/schema';
import { sendEmail } from '../../email/resend';
import { OPERATOR_EMAIL } from '../../operatorContact';
import { weekdayOf, WEEKDAY_LABELS } from '../../lessons/rules';
import type { SendContractEmailResult } from '../email';
import { buildContractEmailHtml, strong, type ContractEmailRow } from '../email-template';
import { formatCurrency, formatDate } from '../format';
import { escapeHtml } from '../html-escape';
import { IDENTITY_DIGITS } from '../identity';
import { SIGN_TOKEN_TTL_DAYS } from '../status';
import { lessonAdminUrl } from './links';
import { cardMonthlyAmount, courseMonths, LESSON_CONTRACT_NAME, PAY_METHOD_NAME, type LessonContractTerms } from './terms';

/** 수강 계약 메일 — 음원 제작 계약 메일과 같은 레이아웃. 링크를 누르기 전에 조건을 확인할 수 있게 본문에도 적는다. */
const termRows = (t: LessonContractTerms): ContractEmailRow[] => [
  { label: '과정', value: `${t.courseWeeks}주 · 총 ${t.courseWeeks}회 (주 1회 ${t.durationMin}분 1:1)` },
  { label: '수업 일정', value: `매주 ${WEEKDAY_LABELS[weekdayOf(t.startDate)]}요일 ${t.startTime} · 첫 수업 ${t.startDate}` },
  { label: '월 수강료', value: `${formatCurrency(t.monthlyAmount)}원 (부가세 별도${t.payMethod === 'card' ? ` · 카드 결제 ${formatCurrency(cardMonthlyAmount(t))}원` : ''})`, emphasis: true },
  { label: '수강료 합계', value: `${formatCurrency(t.monthlyAmount * courseMonths(t))}원 (${courseMonths(t)}개월, 부가세 별도)` },
  { label: '결제 방식', value: PAY_METHOD_NAME[t.payMethod] },
];

const termLines = (t: LessonContractTerms): string[] => termRows(t).map((row) => `${row.label}: ${row.value}`);
const FOOTER = ['', '스튜디오 놀 · 문의 010-4255-7893', '본 메일은 발송 전용입니다.'];

export const sendLessonSignRequestEmail = async (contract: LessonContract, terms: LessonContractTerms, signUrl: string): Promise<SendContractEmailResult> => {
  const html = buildContractEmailHtml({
    heading: `${LESSON_CONTRACT_NAME} 서명 요청`,
    paragraphs: [
      `${escapeHtml(contract.studentName)}님, 안녕하세요. 스튜디오 놀입니다.`,
      `아래 조건을 확인하신 뒤 ${strong('계약서 서명하기')}를 눌러 서명해 주세요. 스튜디오는 이미 서명했습니다.`,
    ],
    rows: termRows(terms),
    cta: { label: '계약서 서명하기', url: signUrl },
    notices: [
      `이 링크는 <strong>${SIGN_TOKEN_TTL_DAYS}일간</strong> 유효합니다. 기한이 지나면 스튜디오에 알려 주세요. 다시 보내 드립니다.`,
      `본인 확인을 위해 서명 화면에서 <strong>연락처 뒤 ${IDENTITY_DIGITS}자리</strong>를 입력하게 됩니다.`,
      '수업에 오지 않으면 그 회차는 진행된 것으로 보고 보강하지 않는다는 점(제4조)을 서명 화면에서 한 번 더 확인해 드려요.',
    ],
  });
  const text = [
    `[${LESSON_CONTRACT_NAME} 서명 요청]`, '',
    `${contract.studentName}님, 안녕하세요. 스튜디오 놀입니다.`, '',
    ...termLines(terms), '',
    `아래 링크에서 계약서를 확인하고 서명해 주세요. (${SIGN_TOKEN_TTL_DAYS}일간 유효)`, signUrl, '',
    `서명 화면에서 본인 확인을 위해 연락처 뒤 ${IDENTITY_DIGITS}자리를 입력하게 됩니다.`,
    ...FOOTER,
  ].join('\n');
  return sendEmail({ to: contract.studentEmail, subject: `[스튜디오 놀] ${contract.studentName}님, ${LESSON_CONTRACT_NAME} 서명 요청`, html, text });
};

/** 체결 메일 — 서명본은 완료 화면에서 다시 볼 수 있다(PDF 첨부는 아직 없다). */
export const sendLessonSignedEmail = async (contract: LessonContract, terms: LessonContractTerms, completeUrl: string): Promise<SendContractEmailResult> => {
  const html = buildContractEmailHtml({
    heading: '계약이 체결되었습니다',
    paragraphs: [`${escapeHtml(contract.studentName)}님, 서명이 끝나 수강 계약이 체결되었습니다. 서명본은 아래 버튼에서 언제든 다시 볼 수 있어요.`],
    rows: [...termRows(terms), { label: '체결일', value: formatDate(contract.signedAt), emphasis: true }],
    cta: { label: '서명본 보기', url: completeUrl },
    notices: ['수강료는 계약서 제3조에 따라 납부해 주세요. 궁금한 점은 010-4255-7893으로 문의해 주세요.'],
  });
  const text = [
    '[계약 체결 안내]', '',
    `${contract.studentName}님, 서명이 끝나 수강 계약이 체결되었습니다.`, '',
    ...termLines(terms), `체결일: ${formatDate(contract.signedAt)}`, '',
    `서명본 보기: ${completeUrl}`, ...FOOTER,
  ].join('\n');
  return sendEmail({ to: contract.studentEmail, subject: `[스튜디오 놀] ${contract.studentName}님, ${LESSON_CONTRACT_NAME}가 체결되었습니다`, html, text });
};

/** 운영자용. 연락처까지 담아 바로 응대할 수 있게 한다. */
export const sendLessonOperatorNotification = async (contract: LessonContract, terms: LessonContractTerms, signed: boolean): Promise<SendContractEmailResult> => {
  const statusText = signed ? '체결 (수강생 서명 완료)' : '발송 (수강생 서명 대기)';
  const html = buildContractEmailHtml({
    heading: `수강 계약 ${statusText}`,
    paragraphs: [`${escapeHtml(contract.studentName)}님의 수강 계약이 ${statusText} 상태입니다.`],
    rows: [
      { label: '수강생', value: contract.studentName, emphasis: true },
      { label: '이메일', value: contract.studentEmail },
      { label: '연락처', value: contract.studentPhone },
      ...termRows(terms),
      ...(signed ? [{ label: '체결일', value: formatDate(contract.signedAt) }] : []),
    ],
    cta: { label: '관리자 화면에서 보기', url: lessonAdminUrl(contract.enrollmentId) },
  });
  const text = [`수강 계약 ${statusText}`, '', `수강생: ${contract.studentName}`, `이메일: ${contract.studentEmail}`, `연락처: ${contract.studentPhone}`, ...termLines(terms), ...(signed ? [`체결일: ${formatDate(contract.signedAt)}`] : [])].join('\n');
  return sendEmail({ to: OPERATOR_EMAIL, subject: `[스튜디오 놀] ${contract.studentName}님 수강 계약 ${statusText}`, html, text });
};
