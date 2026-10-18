import type { ProductionContract } from '../../../db/schema';
import { sendEmail } from '../../email/resend';
import { OPERATOR_EMAIL } from '../../operatorContact';
import type { SendContractEmailResult } from '../email';
import { buildContractEmailHtml, strong, type ContractEmailRow } from '../email-template';
import { formatCurrency, formatDate } from '../format';
import { escapeHtml } from '../html-escape';
import { IDENTITY_DIGITS } from '../identity';
import { SIGN_TOKEN_TTL_DAYS } from '../status';
import { productionAdminUrl } from './links';
import type { ProductionTerms } from './terms';

/**
 * 제작 계약 메일. 레이아웃은 연습실 계약 메일과 같은 것(email-template.ts)을 쓴다 — 서명 요청은 피싱과
 * 구별되어야 하므로 보내는 곳·계약 조건·문의 전화가 드러나는 같은 틀을 유지한다.
 */

const CONTRACT_NAME = '음원 제작 용역 계약서';

/** 링크를 누르기 전에 조건을 확인할 수 있게 메일 본문에도 적는다(연습실과 같은 원칙). */
const termRows = (terms: ProductionTerms): ContractEmailRow[] => [
  { label: '본 곡', value: terms.songTitle ?? '1곡 (제목 미정)' },
  { label: '계약금액', value: `${formatCurrency(terms.amount.total)}원 (부가세 포함)`, emphasis: true },
  { label: '계약금', value: `${formatCurrency(terms.amount.deposit)}원 · 체결 후 ${terms.amount.depositDueDays}일 이내` },
  { label: '잔금', value: `${formatCurrency(terms.amount.balance)}원 · 최종 마스터 승인 후 ${terms.amount.balanceDueDays}일 이내` },
  { label: '작업 기간', value: `약 ${terms.workWeeks}주 (계약금 입금·1차 완성본 수령 후)` },
];

const termLines = (terms: ProductionTerms): string[] =>
  termRows(terms).map((row) => `${row.label}: ${row.value}`);

const accountLine = (terms: ProductionTerms): string =>
  `입금 계좌: ${terms.payment.bank} ${terms.payment.account} (예금주 ${terms.payment.holder})`;

const FOOTER = ['', '스튜디오 놀 · 문의 010-4255-7893', '본 메일은 발송 전용입니다.'];

export const sendProductionSignRequestEmail = async (
  contract: ProductionContract,
  terms: ProductionTerms,
  signUrl: string,
): Promise<SendContractEmailResult> => {
  const html = buildContractEmailHtml({
    heading: `${CONTRACT_NAME} 서명 요청`,
    paragraphs: [
      `${escapeHtml(contract.clientName)}님, 안녕하세요. 스튜디오 놀입니다.`,
      `아래 조건을 확인하신 뒤 ${strong('계약서 서명하기')}를 눌러 서명해 주세요. 스튜디오는 이미 서명했습니다.`,
    ],
    rows: termRows(terms),
    cta: { label: '계약서 서명하기', url: signUrl },
    notices: [
      `이 링크는 <strong>${SIGN_TOKEN_TTL_DAYS}일간</strong> 유효합니다. 기한이 지나면 다시 보내 드립니다.`,
      `본인 확인을 위해 서명 화면에서 <strong>연락처 뒤 ${IDENTITY_DIGITS}자리</strong>를 입력하게 됩니다.`,
      '서명이 끝나면 서명본 PDF와 계약금 입금 안내를 메일로 보내 드립니다.',
    ],
  });

  const text = [
    `[${CONTRACT_NAME} 서명 요청]`,
    '',
    `${contract.clientName}님, 안녕하세요. 스튜디오 놀입니다.`,
    '',
    ...termLines(terms),
    '',
    `아래 링크에서 계약서를 확인하고 서명해 주세요. (${SIGN_TOKEN_TTL_DAYS}일간 유효)`,
    signUrl,
    '',
    `서명 화면에서 본인 확인을 위해 연락처 뒤 ${IDENTITY_DIGITS}자리를 입력하게 됩니다.`,
    ...FOOTER,
  ].join('\n');

  return sendEmail({
    to: contract.clientEmail,
    subject: `[스튜디오 놀] ${contract.clientName}님, ${CONTRACT_NAME} 서명 요청`,
    html,
    text,
  });
};

export const sendProductionSignedEmail = async (
  contract: ProductionContract,
  terms: ProductionTerms,
  pdfBuffer: Buffer | undefined,
  completeUrl: string,
): Promise<SendContractEmailResult> => {
  const html = buildContractEmailHtml({
    heading: '계약이 체결되었습니다',
    paragraphs: [
      `${escapeHtml(contract.clientName)}님, 계약서 서명이 접수되어 계약이 체결되었습니다.`,
      pdfBuffer
        ? '서명본 계약서를 이 메일에 PDF로 첨부했습니다. 보관해 주세요.'
        : '서명본 계약서는 아래 버튼에서 받으실 수 있습니다.',
    ],
    rows: [...termRows(terms), { label: '체결일', value: formatDate(contract.signedAt), emphasis: true }],
    cta: { label: '계약서 PDF 다시 받기', url: completeUrl },
    notices: [
      // 제3조 — 계약금 기한은 체결일부터 센다. 체결 메일이 그 안내를 겸한다.
      `계약금 <strong>${formatCurrency(terms.amount.deposit)}원</strong>을 체결일로부터 ${terms.amount.depositDueDays}일 이내에 입금해 주세요.`,
      escapeHtml(accountLine(terms)),
      '작업 기간은 계약금 입금과 1차 완성본을 모두 받은 날부터 셉니다.',
    ],
  });

  const text = [
    '[계약 체결 안내]',
    '',
    `${contract.clientName}님, 계약서 서명이 접수되어 계약이 체결되었습니다.`,
    '',
    ...termLines(terms),
    `체결일: ${formatDate(contract.signedAt)}`,
    '',
    `계약금 ${formatCurrency(terms.amount.deposit)}원을 체결일로부터 ${terms.amount.depositDueDays}일 이내에 입금해 주세요.`,
    accountLine(terms),
    '',
    ...(pdfBuffer ? ['서명본 계약서를 PDF로 첨부했습니다.'] : []),
    `계약서 다시 받기: ${completeUrl}`,
    ...FOOTER,
  ].join('\n');

  return sendEmail({
    to: contract.clientEmail,
    subject: `[스튜디오 놀] ${contract.clientName}님, ${CONTRACT_NAME}가 체결되었습니다`,
    html,
    text,
    attachments: pdfBuffer
      ? [{ filename: `${contract.clientName}_음원제작용역계약서.pdf`, content: pdfBuffer.toString('base64') }]
      : undefined,
  });
};

/** 운영자용. 연락처까지 담아 바로 응대할 수 있게 한다(연습실과 같다). */
export const sendProductionOperatorNotification = async (
  contract: ProductionContract,
  terms: ProductionTerms,
  signed: boolean,
): Promise<SendContractEmailResult> => {
  const statusText = signed ? '체결 (의뢰인 서명 완료)' : '발송 (의뢰인 서명 대기)';

  const html = buildContractEmailHtml({
    heading: `제작 계약 ${statusText}`,
    paragraphs: [`${escapeHtml(contract.clientName)}님의 제작 계약이 ${statusText} 상태입니다.`],
    rows: [
      { label: '의뢰인', value: contract.clientName, emphasis: true },
      ...(contract.clientStageName ? [{ label: '활동명', value: contract.clientStageName }] : []),
      { label: '이메일', value: contract.clientEmail },
      { label: '연락처', value: contract.clientPhone },
      ...termRows(terms),
      ...(signed ? [{ label: '체결일', value: formatDate(contract.signedAt) }] : []),
    ],
    cta: { label: '관리자 화면에서 보기', url: productionAdminUrl(contract.id) },
  });

  const text = [
    `제작 계약 ${statusText}`,
    '',
    `의뢰인: ${contract.clientName}`,
    `이메일: ${contract.clientEmail}`,
    `연락처: ${contract.clientPhone}`,
    ...termLines(terms),
    ...(signed ? [`체결일: ${formatDate(contract.signedAt)}`] : []),
  ].join('\n');

  return sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[스튜디오 놀] ${contract.clientName}님 제작 계약 ${statusText}`,
    html,
    text,
  });
};
