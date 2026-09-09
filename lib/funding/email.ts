import { formatPriceAmount } from '../../data/pricing';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { formatKstDateTimeFull } from '../booking/format';
import { BANK_ACCOUNT } from './policy';
import type { FundingProject } from './projects';
import type { FundingOrder } from './service';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const manageUrl = (order: FundingOrder): string => `${SITE_URL}/ko/funding/manage/${order.orderNo}?token=${order.manageToken}`;
const PHONE = '문의: 010-4255-7893';

const summaryLines = (order: FundingOrder, project: FundingProject | null): string[] => {
  const p = order.fundingPledge;
  if (!p) return [];
  const reward = project?.rewards.find((r) => r.id === p.rewardId);
  return [
    `프로젝트: ${project?.title ?? p.projectSlug}`,
    `리워드: ${p.rewardTitle} × ${p.quantity}${p.additionalAmount > 0 ? ` + 추가 후원 ${formatPriceAmount(p.additionalAmount)}원` : ''}`,
    `후원 금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
    ...(reward ? [`예상 전달 시기: ${reward.estimatedDelivery}`] : []),
    `주문번호: ${order.orderNo}`,
  ];
};

const send = async (pairs: Array<{ key: string; params: Parameters<typeof sendEmail>[0] }>): Promise<string | null> => {
  const failures: string[] = [];
  for (const { key, params } of pairs) {
    const r = await sendEmail(params);
    if (!r.ok) failures.push(`${key}:${r.errorCode}`);
  }
  return failures.length ? failures.join(', ') : null;
};

export const sendFundingConfirmedEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null> =>
  send([
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: OPERATOR_EMAIL,
      subject: `[스튜디오 놀] 후원이 확정되었습니다 — ${project?.title ?? ''}`,
      text: [`${order.customerName}님, 후원해 주셔서 고맙습니다.`, ...summaryLines(order, project), '', `후원 확인·취소: ${manageUrl(order)}`, PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 후원 확정 ${formatPriceAmount(order.totalAmount)}원 — ${order.customerName}`,
      text: [...summaryLines(order, project), `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
        `결제수단: ${order.fundingPledge?.paymentMethod}`, `메시지: ${order.fundingPledge?.supporterMessage ?? '없음'}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);

export const sendFundingBankDepositEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null> => {
  const pledge = order.fundingPledge;
  if (!pledge) return Promise.resolve('missing_pledge');
  return send([
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: OPERATOR_EMAIL,
      subject: `[스튜디오 놀] 무통장입금 안내 — ${project?.title ?? ''}`,
      text: [
        `${order.customerName}님, 아래 계좌로 입금해 주시면 후원이 확정됩니다.`,
        `계좌: ${BANK_ACCOUNT.bank} ${BANK_ACCOUNT.number} (${BANK_ACCOUNT.holder})`,
        `금액: ${formatPriceAmount(order.totalAmount)}원`,
        `입금자명: ${order.customerName} (후원 신청 이름과 같게 해 주세요)`,
        `입금 기한: ${formatKstDateTimeFull(pledge.holdExpiresAt.toISOString())} — 기한이 지나면 자동 취소됩니다`,
        ...summaryLines(order, project), '', `후원 확인: ${manageUrl(order)}`, PHONE,
      ].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 무통장 대기 ${formatPriceAmount(order.totalAmount)}원 — ${order.customerName}`,
      text: [...summaryLines(order, project), `입금자명(예정): ${order.customerName}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);
};

const CANCEL_SUBJECT = { refunded: '환불이 완료되었습니다', refund_requested: '취소 요청을 접수했습니다', recorded: '환불 처리 안내' } as const;
/**
 * 본문 금액은 totalAmount가 아니라 **실제 환불액**이다 — 부분환불 이력이 있는 건에서 두 값은
 * 다르고, 총액을 적으면 이미 돌려준 몫까지 다시 돌려주는 것처럼 읽힌다.
 */
const CANCEL_BODY = {
  refunded: (amount: number) => `${formatPriceAmount(amount)}원이 결제 수단으로 환불됩니다(카드사에 따라 3~7일).`,
  refund_requested: () => '무통장 후원은 운영자가 확인 후 계좌로 환불합니다. 환불받을 계좌(은행·계좌번호·예금주)를 이 메일에 회신해 주세요.',
  recorded: (amount: number) => `${formatPriceAmount(amount)}원 환불 처리가 완료되었습니다.`,
} as const;

export const sendFundingCancelledEmails = (order: FundingOrder, project: FundingProject | null, mode: 'refunded' | 'refund_requested' | 'recorded', refundAmount: number): Promise<string | null> =>
  send([
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: OPERATOR_EMAIL,
      subject: `[스튜디오 놀] ${CANCEL_SUBJECT[mode]} — ${project?.title ?? ''}`,
      text: [`${order.customerName}님,`, CANCEL_BODY[mode](refundAmount), ...summaryLines(order, project), PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] ${CANCEL_SUBJECT[mode]} — ${order.customerName} (${mode})`,
      text: [...summaryLines(order, project), `환불 금액: ${formatPriceAmount(refundAmount)}원`, `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);
