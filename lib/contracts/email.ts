import { sendEmail, buildEmailHtml } from '../email/resend';
import type { Contract } from '../../db/schema';
import { escapeHtml } from './html-escape';
import { SIGN_TOKEN_TTL_DAYS } from './status';

const OPERATOR_EMAIL = process.env.CONTRACT_OPERATOR_EMAIL || 'hwangtab@gmail.com';

const formatCurrency = (amount: number): string => new Intl.NumberFormat('ko-KR').format(amount);

const formatDate = (date: string | Date | null): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const CELL = 'padding: 12px; border-bottom: 1px solid #e5e5e5;';
const LABEL_CELL = `${CELL} background: #f9f9f9; width: 120px;`;

const row = (label: string, value: string): string =>
  `<tr><td style="${LABEL_CELL}">${escapeHtml(label)}</td><td style="${CELL}">${escapeHtml(value)}</td></tr>`;

const table = (rows: string): string =>
  `<table style="width: 100%; border-collapse: collapse; margin: 24px 0; border: 1px solid #e5e5e5;">${rows}</table>`;

export interface SendContractEmailResult {
  ok: boolean;
  errorCode?: string;
  errorDetail?: string;
}

export const sendContractCreatedEmail = async (
  contract: Contract,
  signUrl: string,
): Promise<SendContractEmailResult> => {
  const subject = `[Studio NOL] ${contract.customerName}님, 음악연습실 이용계약서 서명 요청`;

  // signUrl은 우리가 만든 값이지만 href·본문에 들어가므로 동일하게 이스케이프한다.
  const safeUrl = escapeHtml(signUrl);

  const body = `
    <p>${escapeHtml(contract.customerName)}님, 안녕하세요. 스튜디오 놀입니다.</p>
    <p>아래 내용 확인 후 계약서 서명을 완료해 주세요.</p>
    ${table(
      row('계약 기간', `${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`) +
        row('이용 호실', `${contract.roomNumber}호`) +
        row('월 이용료', `월 ${formatCurrency(contract.monthlyRent)}원`) +
        row('보증금', `${formatCurrency(contract.depositAmount)}원 (계약 시 면제)`),
    )}
    <div style="text-align: center; margin: 32px 0;">
      <a href="${safeUrl}" style="display: inline-block; padding: 14px 32px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">계약서 서명하기</a>
    </div>
    <p style="font-size: 13px; color: #666;">
      이 링크는 <strong>${SIGN_TOKEN_TTL_DAYS}일간</strong> 유효합니다. 기한이 지나면 운영자에게 재발송을 요청해 주세요.<br />
      버튼이 눌리지 않으면 아래 주소를 복사해 브라우저에 붙여 넣으세요.<br />${safeUrl}
    </p>
  `;

  const text = [
    '[음악연습실 이용계약서 서명 요청]',
    '',
    `${contract.customerName}님, 안녕하세요. 스튜디오 놀입니다.`,
    '',
    `계약 기간: ${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`,
    `이용 호실: ${contract.roomNumber}호`,
    `월 이용료: ${formatCurrency(contract.monthlyRent)}원`,
    `보증금: ${formatCurrency(contract.depositAmount)}원 (계약 시 면제)`,
    '',
    `아래 링크에서 계약서를 확인하고 서명해 주세요. (${SIGN_TOKEN_TTL_DAYS}일간 유효)`,
    signUrl,
    '',
    '본 메일은 발송 전용입니다.',
  ].join('\n');

  return sendEmail({
    to: contract.customerEmail,
    subject,
    html: buildEmailHtml({
      title: '음악연습실 이용계약서 서명 요청',
      body,
      footer: '본 메일은 발송 전용입니다.',
    }),
    text,
  });
};

export const sendContractSignedEmail = async (
  contract: Contract,
  pdfBuffer?: Buffer,
): Promise<SendContractEmailResult> => {
  const subject = `[Studio NOL] ${contract.customerName}님, 이용계약서 서명이 완료되었습니다`;

  const body = `
    <p>${escapeHtml(contract.customerName)}님, 계약서 서명이 정상적으로 완료되었습니다.</p>
    ${table(
      row('계약 기간', `${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`) +
        row('이용 호실', `${contract.roomNumber}호`) +
        row('월 이용료', `월 ${formatCurrency(contract.monthlyRent)}원`) +
        row('서명일', formatDate(contract.signedAt)),
    )}
    ${pdfBuffer ? '<p>서명이 완료된 계약서를 PDF로 첨부합니다. 보관해 주세요.</p>' : ''}
  `;

  const text = [
    '[이용계약서 서명 완료]',
    '',
    `${contract.customerName}님, 계약서 서명이 정상적으로 완료되었습니다.`,
    '',
    `계약 기간: ${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`,
    `이용 호실: ${contract.roomNumber}호`,
    `월 이용료: ${formatCurrency(contract.monthlyRent)}원`,
    `서명일: ${formatDate(contract.signedAt)}`,
    '',
    '본 메일은 발송 전용입니다.',
  ].join('\n');

  return sendEmail({
    to: contract.customerEmail,
    subject,
    html: buildEmailHtml({ title: '이용계약서 서명 완료', body, footer: '본 메일은 발송 전용입니다.' }),
    text,
    attachments: pdfBuffer
      ? [
          {
            filename: `${contract.customerName}_이용계약서.pdf`,
            content: pdfBuffer.toString('base64'),
          },
        ]
      : undefined,
  });
};

export const sendOperatorContractNotification = async (
  contract: Contract,
  signed: boolean,
): Promise<SendContractEmailResult> => {
  const statusText = signed ? '서명 완료' : '발송 완료 (서명 대기)';
  const subject = signed
    ? `[Studio NOL] ${contract.customerName}님 계약서 서명 완료`
    : `[Studio NOL] ${contract.customerName}님에게 계약서 발송 완료`;

  const body = table(
    row('이용자', contract.customerName) +
      row('이메일', contract.customerEmail) +
      row('연락처', contract.customerPhone) +
      row('호실', `${contract.roomNumber}호`) +
      row('계약 기간', `${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`) +
      row('월 이용료', `${formatCurrency(contract.monthlyRent)}원`) +
      row('상태', statusText),
  );

  const text = [
    `계약서 ${statusText}`,
    '',
    `이용자: ${contract.customerName}`,
    `이메일: ${contract.customerEmail}`,
    `연락처: ${contract.customerPhone}`,
    `호실: ${contract.roomNumber}호`,
    `계약 기간: ${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`,
    `월 이용료: ${formatCurrency(contract.monthlyRent)}원`,
  ].join('\n');

  return sendEmail({
    to: OPERATOR_EMAIL,
    subject,
    html: buildEmailHtml({ title: `계약서 ${statusText}`, body }),
    text,
  });
};
