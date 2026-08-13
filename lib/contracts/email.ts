import { sendEmail } from '../email/resend';
import type { Contract } from '../../db/schema';
import { buildContractEmailHtml, strong, type ContractEmailRow } from './email-template';
import { formatCompactDate, formatCurrency, formatDate } from './format';
import { escapeHtml } from './html-escape';
import { IDENTITY_DIGITS } from './identity';
import { SIGN_TOKEN_TTL_DAYS } from './status';

const OPERATOR_EMAIL = process.env.CONTRACT_OPERATOR_EMAIL || 'hwangtab@gmail.com';


const period = (contract: Contract): string =>
  `${formatCompactDate(contract.startDate)} ~ ${formatCompactDate(contract.endDate)}`;

/** 계약 조건은 메일 본문에도 그대로 적는다 — 링크를 누르기 전에 확인할 수 있어야 한다. */
const contractRows = (contract: Contract): ContractEmailRow[] => [
  { label: '이용 호실', value: `${contract.roomNumber}호` },
  { label: '계약 기간', value: period(contract) },
  { label: '월 이용료', value: `${formatCurrency(contract.monthlyRent)}원`, emphasis: true },
  { label: '보증금', value: `${formatCurrency(contract.depositAmount)}원 (계약 시 면제)` },
  { label: '납부일', value: `매월 ${contract.paymentDay}일 선불` },
];

export interface SendContractEmailResult {
  ok: boolean;
  errorCode?: string;
  errorDetail?: string;
}

export const sendContractCreatedEmail = async (
  contract: Contract,
  signUrl: string,
): Promise<SendContractEmailResult> => {
  const html = buildContractEmailHtml({
    heading: '음악연습실 이용계약서 서명 요청',
    paragraphs: [
      `${escapeHtml(contract.customerName)}님, 안녕하세요. 스튜디오 놀입니다.`,
      `아래 계약 조건을 확인하신 뒤 ${strong('계약서 서명하기')}를 눌러 서명을 완료해 주세요.`,
    ],
    rows: contractRows(contract),
    cta: { label: '계약서 서명하기', url: signUrl },
    notices: [
      `이 링크는 <strong>${SIGN_TOKEN_TTL_DAYS}일간</strong> 유효합니다. 기한이 지나면 다시 보내 드립니다.`,
      `본인 확인을 위해 서명 화면에서 <strong>연락처 뒤 ${IDENTITY_DIGITS}자리</strong>를 입력하게 됩니다.`,
      '서명이 끝나면 서명본 PDF를 첨부한 확인 메일을 보내 드립니다.',
    ],
  });

  const text = [
    '[음악연습실 이용계약서 서명 요청]',
    '',
    `${contract.customerName}님, 안녕하세요. 스튜디오 놀입니다.`,
    '',
    `이용 호실: ${contract.roomNumber}호`,
    `계약 기간: ${period(contract)}`,
    `월 이용료: ${formatCurrency(contract.monthlyRent)}원`,
    `보증금: ${formatCurrency(contract.depositAmount)}원 (계약 시 면제)`,
    `납부일: 매월 ${contract.paymentDay}일 선불`,
    '',
    `아래 링크에서 계약서를 확인하고 서명해 주세요. (${SIGN_TOKEN_TTL_DAYS}일간 유효)`,
    signUrl,
    '',
    `서명 화면에서 본인 확인을 위해 연락처 뒤 ${IDENTITY_DIGITS}자리를 입력하게 됩니다.`,
    '',
    '스튜디오 놀 · 문의 010-4255-7893',
    '본 메일은 발송 전용입니다.',
  ].join('\n');

  return sendEmail({
    to: contract.customerEmail,
    subject: `[스튜디오 놀] ${contract.customerName}님, 음악연습실 이용계약서 서명 요청`,
    html,
    text,
  });
};

export const sendContractSignedEmail = async (
  contract: Contract,
  pdfBuffer?: Buffer,
  downloadUrl?: string,
): Promise<SendContractEmailResult> => {
  const html = buildContractEmailHtml({
    heading: '계약서 서명이 완료되었습니다',
    paragraphs: [
      `${escapeHtml(contract.customerName)}님, 계약서 서명이 정상적으로 접수되었습니다.`,
      pdfBuffer
        ? '서명본 계약서를 이 메일에 PDF로 첨부했습니다. 보관해 주세요.'
        : '서명본 계약서는 아래 버튼에서 받으실 수 있습니다.',
    ],
    rows: [
      ...contractRows(contract),
      { label: '서명 완료', value: formatDate(contract.signedAt), emphasis: true },
    ],
    cta: downloadUrl ? { label: '계약서 PDF 다시 받기', url: downloadUrl } : undefined,
    notices: [
      '이용 시작일부터 24시간 상시 이용하실 수 있습니다.',
      '입금 계좌: 카카오뱅크 3333-12-5480849 (예금주: 황경하 / 스튜디오 놀)',
      '시설 이용 중 불편한 점이 있으면 언제든 연락해 주세요.',
    ],
  });

  const text = [
    '[이용계약서 서명 완료]',
    '',
    `${contract.customerName}님, 계약서 서명이 정상적으로 접수되었습니다.`,
    '',
    `이용 호실: ${contract.roomNumber}호`,
    `계약 기간: ${period(contract)}`,
    `월 이용료: ${formatCurrency(contract.monthlyRent)}원`,
    `서명 완료: ${formatDate(contract.signedAt)}`,
    '',
    pdfBuffer ? '서명본 계약서를 PDF로 첨부했습니다.' : '',
    downloadUrl ? `계약서 다시 받기: ${downloadUrl}` : '',
    '',
    '입금 계좌: 카카오뱅크 3333-12-5480849 (예금주: 황경하 / 스튜디오 놀)',
    '',
    '스튜디오 놀 · 문의 010-4255-7893',
    '본 메일은 발송 전용입니다.',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return sendEmail({
    to: contract.customerEmail,
    subject: `[스튜디오 놀] ${contract.customerName}님, 이용계약서 서명이 완료되었습니다`,
    html,
    text,
    attachments: pdfBuffer
      ? [
          {
            filename: `${contract.customerName}_음악연습실_이용계약서.pdf`,
            content: pdfBuffer.toString('base64'),
          },
        ]
      : undefined,
  });
};

/** 운영자용. 고객에게 가는 메일과 달리 연락처까지 담아 바로 응대할 수 있게 한다. */
export const sendOperatorContractNotification = async (
  contract: Contract,
  signed: boolean,
): Promise<SendContractEmailResult> => {
  const statusText = signed ? '서명 완료' : '발송 완료 (서명 대기)';

  const html = buildContractEmailHtml({
    heading: `계약서 ${statusText}`,
    paragraphs: [`${escapeHtml(contract.customerName)}님의 계약이 ${statusText} 상태입니다.`],
    rows: [
      { label: '이용자', value: contract.customerName, emphasis: true },
      { label: '이메일', value: contract.customerEmail },
      { label: '연락처', value: contract.customerPhone },
      ...contractRows(contract),
      ...(signed ? [{ label: '서명 완료', value: formatDate(contract.signedAt) }] : []),
    ],
    cta: {
      label: '관리자 화면에서 보기',
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr'}/admin/contracts/${contract.id}`,
    },
  });

  const text = [
    `계약서 ${statusText}`,
    '',
    `이용자: ${contract.customerName}`,
    `이메일: ${contract.customerEmail}`,
    `연락처: ${contract.customerPhone}`,
    `호실: ${contract.roomNumber}호`,
    `계약 기간: ${period(contract)}`,
    `월 이용료: ${formatCurrency(contract.monthlyRent)}원`,
    ...(signed ? [`서명 완료: ${formatDate(contract.signedAt)}`] : []),
  ].join('\n');

  return sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[스튜디오 놀] ${contract.customerName}님 계약서 ${statusText}`,
    html,
    text,
  });
};
