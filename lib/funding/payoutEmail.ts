import { formatPriceAmount } from '../../data/pricing';
import { adminUrl, buildEmailLayout, escapeHtml, type EmailLayoutRow } from '../email/layout';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

import { SITE_URL } from './email';
import { recordedVatDeduction } from './payout';

import type { FundingProjectPayout } from '../../db/schema';
import type { FundingPayoutAccountMasked } from './payoutAccount';

/**
 * 정산 기록·지급 알림. 수신자는 개설자(`fundingCreators.email`) 하나다 — 운영자는 버튼을
 * 직접 누른 당사자라 결과를 이미 안다.
 *
 * **계좌번호 전체를 싣지 않는다.** 메일은 전달·전달·보관되는 문서라, 어디로 흘러갈지
 * 우리가 통제하지 못한다. 어느 계좌로 보냈는지 확인하는 데는 은행·예금주·뒤 4자리로
 * 충분하고, 그 이상은 알려 줄 필요가 없는 정보다.
 *
 * **발송 실패가 기록·지급을 실패시키지 않는다** — 실패 사유 문자열을 돌려줄 뿐이고,
 * 호출부(관리자 API)가 그것을 warnings로 화면에 보여주고 운영자 폴백 알림을 보낸다.
 * `reviewEmail.ts`·`creatorEmail.ts`와 같은 규약이다.
 */
const accountValue = (account: FundingPayoutAccountMasked | null): string => {
  if (!account) return '등록된 계좌 정보를 읽지 못했어요.';
  /**
   * 은행명·예금주는 암호문 안에 있어 서버가 키로 열어야 나온다(`payoutAccount.ts`). 열지
   * 못하면 그 두 칸만 비는데, 그때 빈 칸을 남기면 "입금 계좌:  (뒤 4자리 1234)"가 되어
   * 개설자는 무엇이 빠진 것인지 알 수 없다. 읽은 것만 적고 못 읽은 것은 말한다.
   */
  const who = account.bankName && account.holder
    ? `${account.bankName} ${account.holder}`
    : '등록하신 계좌(은행명·예금주는 이 메일을 만들 때 읽지 못했어요)';
  return `${who} (계좌번호 뒤 4자리 ${account.accountLast4 ?? '확인 필요'})`;
};
const accountLine = (account: FundingPayoutAccountMasked | null): string => `입금 계좌: ${accountValue(account)}`;

/**
 * 계산 내역을 항목별로 적는다. 합계만 보내면 개설자는 왜 그 금액인지 알 수 없고,
 * 그 질문이 그대로 문의가 된다.
 *
 * `manualGrossAmount`(운영자 수기 등록 몫)는 여기 적지 않는다 — 기록 행에 남는 값이
 * 아니라서(`funding_project_payouts`에 컬럼이 없다) 기록 뒤에는 재현할 수 없고, 없는
 * 숫자를 메일에 적을 수는 없다. 결제 수수료가 그 몫만큼 이미 빠져 있으므로 개설자가
 * 손해 보는 방향도 아니다.
 *
 * **요율도 적지 않는다.** 같은 이유다 — 기록 행은 금액만 고정하고 요율 컬럼이 없다. 지급 메일은
 * 기록보다 늦게 나가고, 그 사이에 상수가 바뀌었으면 기록된 금액 옆에 그와 안 맞는 요율이 찍힌다.
 * 개설자가 받는 문서에 서로 안 맞는 두 숫자를 나란히 적을 수는 없다.
 */
const breakdownRows = (payout: FundingProjectPayout): EmailLayoutRow[] => {
  const vatDeduction = recordedVatDeduction(payout);
  return [
    { label: '모금액', value: `${formatPriceAmount(payout.grossAmount)}원` },
    ...(payout.refundAmount > 0 ? [{ label: '환불', value: `−${formatPriceAmount(payout.refundAmount)}원` }] : []),
    { label: '플랫폼 수수료(부가세 포함)', value: `−${formatPriceAmount(payout.platformFeeAmount)}원` },
    { label: '결제 수수료', value: `−${formatPriceAmount(payout.paymentFeeAmount)}원` },
    // 원천징수 개설자만 생긴다(개설자 약관 제6조) — 사업자는 정산금에 세금계산서를 발행한다.
    ...(vatDeduction > 0
      ? [{ label: '부가세 상당액(개인 정산, 수수료를 뗀 금액의 10/110)', value: `−${formatPriceAmount(vatDeduction)}원` }]
      : []),
    ...(payout.withholdingAmount > 0
      ? [{ label: '원천징수', value: `−${formatPriceAmount(payout.withholdingAmount)}원` }]
      : []),
    // 설계·제작 대금은 개설자와 합의해 정산 때 받기로 한 금액이다(개설자 약관 제6조).
    ...(payout.designFeeOffsetAmount > 0
      ? [{ label: '펀딩 설계비(부가세 포함)', value: `−${formatPriceAmount(payout.designFeeOffsetAmount)}원` }]
      : []),
    ...(payout.productionFeeOffsetAmount > 0
      ? [{ label: '제작비(부가세 포함)', value: `−${formatPriceAmount(payout.productionFeeOffsetAmount)}원` }]
      : []),
    { label: '실지급액', value: `${formatPriceAmount(payout.netAmount)}원`, emphasis: true },
    ...(payout.shortfallAmount > 0
      ? [{ label: '정산금으로 충당하지 못한 대금', value: `${formatPriceAmount(payout.shortfallAmount)}원 — 추가 청구나 제작 규모 조정은 따로 상의드려요.` }]
      : []),
    { label: '확정 후원', value: `${payout.backerCount}건` },
  ];
};

/** 텍스트 메일은 같은 행을 `라벨: 값` 줄로 — 표와 본문이 한 원천에서 나온다. */
const breakdownLines = (payout: FundingProjectPayout): string[] =>
  breakdownRows(payout).map((row) => `${row.label}: ${row.value}`);

export const buildFundingPayoutRecordedText = (
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  [
    `"${projectTitle}" 프로젝트의 정산 금액이 확정됐어요.`,
    '',
    ...breakdownLines(payout),
    '',
    accountLine(account),
    '',
    '이체가 끝나면 다시 알려 드려요. 금액이나 계좌가 다르면 이체 전에 알려 주세요.',
    `문의: ${CUSTOMER_REPLY_TO}`,
  ].join('\n');

export const buildFundingPayoutPaidText = (
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  [
    `"${projectTitle}" 프로젝트의 정산금을 보냈어요.`,
    '',
    ...breakdownLines(payout),
    '',
    accountLine(account),
    ...(payout.memo ? ['', `메모: ${payout.memo}`] : []),
    '',
    '입금이 확인되지 않으면 알려 주세요.',
    `문의: ${CUSTOMER_REPLY_TO}`,
  ].join('\n');

export const buildFundingPayoutRecordedHtml = (
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  buildEmailLayout({
    preheader: `${projectTitle} — 실지급액 ${formatPriceAmount(payout.netAmount)}원`,
    heading: '정산 금액이 확정됐어요',
    paragraphs: [`"${escapeHtml(projectTitle)}" 프로젝트의 정산 금액이 확정됐어요.`],
    rows: [...breakdownRows(payout), { label: '입금 계좌', value: accountValue(account) }],
    notices: [
      '이체가 끝나면 다시 알려 드려요. 금액이나 계좌가 다르면 이체 전에 알려 주세요.',
      `문의: ${escapeHtml(CUSTOMER_REPLY_TO)}`,
    ],
  });

export const buildFundingPayoutPaidHtml = (
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  buildEmailLayout({
    preheader: `${projectTitle} — ${formatPriceAmount(payout.netAmount)}원을 보냈어요.`,
    heading: '정산금을 보냈어요',
    paragraphs: [`"${escapeHtml(projectTitle)}" 프로젝트의 정산금을 보냈어요.`],
    rows: [
      ...breakdownRows(payout),
      { label: '입금 계좌', value: accountValue(account) },
      ...(payout.memo ? [{ label: '메모', value: payout.memo }] : []),
    ],
    notices: ['입금이 확인되지 않으면 알려 주세요.', `문의: ${escapeHtml(CUSTOMER_REPLY_TO)}`],
  });

export const sendFundingPayoutRecordedEmail = async (
  creatorEmail: string,
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): Promise<string | null> => {
  const result = await sendEmail({
    to: creatorEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] 정산 금액이 확정됐어요 — ${projectTitle}`,
    text: buildFundingPayoutRecordedText(projectTitle, payout, account),
    html: buildFundingPayoutRecordedHtml(projectTitle, payout, account),
  });
  return result.ok ? null : `creator:${result.errorCode}`;
};

export const sendFundingPayoutPaidEmail = async (
  creatorEmail: string,
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): Promise<string | null> => {
  const result = await sendEmail({
    to: creatorEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] 정산금을 보냈어요 — ${projectTitle}`,
    text: buildFundingPayoutPaidText(projectTitle, payout, account),
    html: buildFundingPayoutPaidHtml(projectTitle, payout, account),
  });
  return result.ok ? null : `creator:${result.errorCode}`;
};

/**
 * 개설자 메일이 실패했을 때 운영자에게 알린다. 이 실패는 HTTP 응답의 warnings에만 남고,
 * 운영자가 탭을 닫으면 사실 자체가 사라진다 — 기록·지급은 프로젝트당 사실상 한 번이라
 * 다시 눌러 재발송할 수도 없다(두 번째는 409가 난다).
 */
export const sendFundingPayoutOperatorFallback = async (
  projectId: string,
  projectTitle: string,
  what: '정산 기록' | '정산 지급',
  creatorEmail: string,
  reason: string,
): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[펀딩] ${what} 알림 메일 발송 실패 — ${projectTitle}`,
    text: [
      `${what}은 정상 처리됐지만 개설자에게 보내는 알림 메일이 실패했어요.`,
      `수신 시도 주소: ${creatorEmail}`,
      `실패 사유: ${reason}`,
      '',
      '개설자는 이 사실을 몰라요. 위 주소로 직접 알려 주세요.',
      '',
      `심사 화면: ${SITE_URL}/admin/funding/projects/${projectId}`,
    ].join('\n'),
    html: buildEmailLayout({
      audience: 'operator',
      noticeTone: 'alert',
      preheader: `${creatorEmail} · ${what} 알림 메일 발송 실패`,
      heading: `${what} 알림 메일 발송 실패`,
      rows: [
        { label: '프로젝트', value: projectTitle },
        { label: '수신 시도 주소', value: creatorEmail, href: `mailto:${creatorEmail}` },
        { label: '실패 사유', value: reason },
      ],
      cta: { label: '심사 화면 열기', url: adminUrl(`/admin/funding/projects/${projectId}`) },
      notices: [`${escapeHtml(what)}은 정상 처리됐지만 개설자에게 보내는 알림 메일이 실패했어요. 개설자는 이 사실을 몰라요. 위 주소로 직접 알려 주세요.`],
    }),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};
