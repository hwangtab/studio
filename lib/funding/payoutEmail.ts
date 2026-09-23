import { FUNDING_PLATFORM_FEE_PERCENT, FUNDING_WITHHOLDING_PERCENT, formatPriceAmount } from '../../data/pricing';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

import { SITE_URL } from './email';

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
const accountLine = (account: FundingPayoutAccountMasked | null): string =>
  account
    ? `입금 계좌: ${account.bankName} ${account.holder} (계좌번호 뒤 4자리 ${account.accountLast4 ?? '확인 필요'})`
    : '입금 계좌: 등록된 계좌 정보를 읽지 못했습니다.';

/**
 * 계산 내역을 항목별로 적는다. 합계만 보내면 개설자는 왜 그 금액인지 알 수 없고,
 * 그 질문이 그대로 문의가 된다.
 *
 * `manualGrossAmount`(운영자 수기 등록 몫)는 여기 적지 않는다 — 기록 행에 남는 값이
 * 아니라서(`funding_project_payouts`에 컬럼이 없다) 기록 뒤에는 재현할 수 없고, 없는
 * 숫자를 메일에 적을 수는 없다. 결제 수수료가 그 몫만큼 이미 빠져 있으므로 개설자가
 * 손해 보는 방향도 아니다.
 */
const breakdownLines = (payout: FundingProjectPayout): string[] => [
  `모금액: ${formatPriceAmount(payout.grossAmount)}원`,
  ...(payout.refundAmount > 0 ? [`환불: −${formatPriceAmount(payout.refundAmount)}원`] : []),
  `플랫폼 수수료(${FUNDING_PLATFORM_FEE_PERCENT}%, 부가세 포함): −${formatPriceAmount(payout.platformFeeAmount)}원`,
  `결제 수수료: −${formatPriceAmount(payout.paymentFeeAmount)}원`,
  ...(payout.withholdingAmount > 0
    ? [`원천징수(${FUNDING_WITHHOLDING_PERCENT}%): −${formatPriceAmount(payout.withholdingAmount)}원`]
    : []),
  `실지급액: ${formatPriceAmount(payout.netAmount)}원`,
  `확정 후원: ${payout.backerCount}건`,
];

export const buildFundingPayoutRecordedText = (
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  [
    `"${projectTitle}" 프로젝트의 정산 금액이 확정되었습니다.`,
    '',
    ...breakdownLines(payout),
    '',
    accountLine(account),
    '',
    '이체가 끝나면 다시 알려 드립니다. 금액이나 계좌가 다르면 이체 전에 알려 주세요.',
    `문의: ${CUSTOMER_REPLY_TO}`,
  ].join('\n');

export const buildFundingPayoutPaidText = (
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  [
    `"${projectTitle}" 프로젝트의 정산금을 보냈습니다.`,
    '',
    ...breakdownLines(payout),
    '',
    accountLine(account),
    ...(payout.memo ? ['', `메모: ${payout.memo}`] : []),
    '',
    '입금이 확인되지 않으면 알려 주세요.',
    `문의: ${CUSTOMER_REPLY_TO}`,
  ].join('\n');

export const sendFundingPayoutRecordedEmail = async (
  creatorEmail: string,
  projectTitle: string,
  payout: FundingProjectPayout,
  account: FundingPayoutAccountMasked | null,
): Promise<string | null> => {
  const result = await sendEmail({
    to: creatorEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] 정산 금액이 확정되었습니다 — ${projectTitle}`,
    text: buildFundingPayoutRecordedText(projectTitle, payout, account),
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
    subject: `[스튜디오 놀] 정산금을 보냈습니다 — ${projectTitle}`,
    text: buildFundingPayoutPaidText(projectTitle, payout, account),
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
      `${what}은 정상 처리됐지만 개설자에게 보내는 알림 메일이 실패했습니다.`,
      `수신 시도 주소: ${creatorEmail}`,
      `실패 사유: ${reason}`,
      '',
      '개설자는 이 사실을 모릅니다. 위 주소로 직접 알려 주세요.',
      '',
      `심사 화면: ${SITE_URL}/admin/funding/projects/${projectId}`,
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};
