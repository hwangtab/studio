/**
 * 구독(빌링키 자동결제) 메일. lib/booking/email.ts와 같은 패턴 —
 * 전부 실패 요약(string) 또는 null(성공)을 돌려주고, notificationError로 저장된다.
 */
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO } from '../booking/email';
import { OPERATOR_EMAIL } from '../operatorContact';
import type { Subscription } from '../../db/schema';
import { formatPriceAmount } from '../../data/pricing';
import { subscriptionOrderName } from './amounts';

export { CUSTOMER_REPLY_TO };

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

export const subscriptionSetupUrl = (sub: Pick<Subscription, 'id'>, setupToken: string): string =>
  `${SITE_URL}/ko/subscribe/${sub.id}?token=${setupToken}`;

export const subscriptionManageUrl = (sub: Pick<Subscription, 'id' | 'manageToken'>): string =>
  `${SITE_URL}/ko/subscribe/manage/${sub.id}?token=${sub.manageToken}`;

const amountLine = (sub: Pick<Subscription, 'totalAmount'>): string =>
  `월 ${formatPriceAmount(sub.totalAmount)}원 (VAT 포함)`;

/** 카드 등록 안내. 등록 즉시 첫 달치가 결제된다는 사실을 반드시 명시한다(스펙 §6). */
export const sendSubscriptionSetupEmail = (
  sub: Pick<Subscription, 'id' | 'kind' | 'customerEmail' | 'customerName' | 'totalAmount' | 'billingDay'>,
  setupUrl: string,
): Promise<string | null> =>
  sendEmail({
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub.kind)} 정기결제 카드 등록 안내`,
    text: [
      `${sub.customerName}님, ${subscriptionOrderName(sub.kind)} 정기결제를 위한 카드 등록을 안내드립니다.`,
      `상품: ${subscriptionOrderName(sub.kind)}`,
      `${amountLine(sub)}`,
      `결제일: 매월 ${sub.billingDay}일`,
      '',
      '아래 링크에서 카드를 등록하면 즉시 첫 달치가 결제되고, 이후 매월 같은 날 자동으로 결제됩니다.',
      setupUrl,
      '',
      '링크는 발급일로부터 7일간 유효합니다.',
      '문의: 010-4255-7893',
    ].join('\n'),
  }).then((result) => (result.ok ? null : `setup:${result.errorCode}`));

/** 카드 등록 + 첫 결제 성공 확정. */
export const sendSubscriptionActivatedEmail = (
  sub: Pick<Subscription, 'kind' | 'customerEmail' | 'customerName' | 'billingDay'>,
  input: { manageUrl: string; amount: number },
): Promise<string | null> =>
  sendEmail({
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub.kind)} 정기결제가 시작되었습니다`,
    text: [
      `${sub.customerName}님, 카드 등록과 첫 결제가 완료되어 정기결제가 시작되었습니다.`,
      `이번 결제: ${formatPriceAmount(input.amount)}원 (VAT 포함)`,
      `다음 결제일: 매월 ${sub.billingDay}일`,
      '',
      `구독 조회·해지: ${input.manageUrl}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  }).then((result) => (result.ok ? null : `activated:${result.errorCode}`));

/** 매월 결제 완료. */
export const sendSubscriptionChargedEmail = (
  sub: Pick<Subscription, 'kind' | 'customerEmail' | 'customerName'>,
  input: { amount: number; cycleYm: string; paymentKey?: string; manageUrl: string },
): Promise<string | null> =>
  sendEmail({
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub.kind)} ${input.cycleYm} 결제가 완료되었습니다`,
    text: [
      `${sub.customerName}님, ${input.cycleYm}분 ${subscriptionOrderName(sub.kind)}가 결제되었습니다.`,
      `결제 금액: ${formatPriceAmount(input.amount)}원 (VAT 포함)`,
      '',
      `구독 조회·해지: ${input.manageUrl}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  }).then((result) => (result.ok ? null : `charged:${result.errorCode}`));

/** 결제 실패 — 재시도 예정 또는 정지 안내(마지막 재시도까지 소진하면 nextRetryAt이 null). */
export const sendSubscriptionChargeFailedEmail = (
  sub: Pick<Subscription, 'kind' | 'customerEmail' | 'customerName'>,
  input: {
    amount: number;
    cycleYm: string;
    nextRetryAt: Date | null;
    manageUrl: string;
    cardChangeHint: string;
  },
): Promise<string | null> => {
  const statusLine = input.nextRetryAt
    ? `${input.nextRetryAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}에 다시 결제를 시도합니다.`
    : '재시도 한도를 넘어 정기결제가 정지되었습니다. 카드를 재등록해야 이용이 계속됩니다.';

  return sendEmail({
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub.kind)} ${input.cycleYm} 결제에 실패했습니다`,
    text: [
      `${sub.customerName}님, ${input.cycleYm}분 ${subscriptionOrderName(sub.kind)} 결제(${formatPriceAmount(input.amount)}원)에 실패했습니다.`,
      statusLine,
      '',
      input.cardChangeHint,
      `구독 조회·카드 변경: ${input.manageUrl}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  }).then((result) => (result.ok ? null : `charge_failed:${result.errorCode}`));
};

/** 해지 확인. 즉시 환불 없이 이미 결제한 기간까지 이용 가능함을 안내한다. */
export const sendSubscriptionCancelledEmail = (
  sub: Pick<Subscription, 'kind' | 'customerEmail' | 'customerName'>,
  input: { endsAt: Date },
): Promise<string | null> =>
  sendEmail({
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub.kind)} 정기결제가 해지되었습니다`,
    text: [
      `${sub.customerName}님, ${subscriptionOrderName(sub.kind)} 정기결제 해지가 접수되었습니다.`,
      `${input.endsAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}까지는 계속 이용하실 수 있고, 이후 청구는 없습니다.`,
      '',
      '문의: 010-4255-7893',
    ].join('\n'),
  }).then((result) => (result.ok ? null : `cancelled:${result.errorCode}`));

export type SubscriptionAlertKind = 'paused' | 'first_charge_failed' | 'cancelled';

/** 운영자 알림. kind는 발생 사건을 나타낸다. */
export const sendSubscriptionOperatorAlert = (
  sub: Pick<Subscription, 'id' | 'kind' | 'customerName' | 'customerPhone'>,
  kind: SubscriptionAlertKind,
  detail: string,
): Promise<string | null> => {
  const titleByKind: Record<SubscriptionAlertKind, string> = {
    paused: '정기결제 정지',
    first_charge_failed: '첫 결제 실패',
    cancelled: '고객 해지',
  };

  return sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[구독] ${titleByKind[kind]} — ${subscriptionOrderName(sub.kind)} · ${sub.customerName}`,
    text: [
      `구독 ${sub.id} (${subscriptionOrderName(sub.kind)}) — ${titleByKind[kind]}`,
      `고객: ${sub.customerName} / ${sub.customerPhone}`,
      detail,
      `관리자: ${SITE_URL}/admin/subscriptions/${sub.id}`,
    ].join('\n'),
  }).then((result) => (result.ok ? null : `operator:${result.errorCode}`));
};
