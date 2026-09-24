/**
 * 구독(빌링키 자동결제) 메일. lib/booking/email.ts와 같은 패턴 —
 * 전부 실패 요약(string) 또는 null(성공)을 돌려주고, notificationError로 저장된다.
 */
import { sendEmail } from '../email/resend';
import { isPurgedValue } from '../privacy/orderRetention';
import { CUSTOMER_REPLY_TO } from '../operatorContact';
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

/**
 * 고객 메일 한 통. **파기된 주소에는 보내지 않고, 실패로도 세지 않는다.**
 *
 * 보관 기간이 지난 구독은 이메일 칸이 파기 표식으로 덮인다
 * (`lib/privacy/orderRetention.ts`). 그 값을 그대로 `sendEmail`에 넘기면 발송은 어차피
 * 막히지만(`isUndeliverableAddress`) 실패 문자열이 돌아와 `notificationError`에 박히고,
 * 그 칸은 관리자 화면에 "고객이 메일을 못 받았다"로 뜬다 — 파기했으니 못 받는 것이 맞는데
 * 영영 꺼지지 않는 경보가 된다. 예약 쪽 `lib/booking/email.ts`의 `sendCustomerEmail`,
 * 펀딩 쪽 `lib/funding/email.ts`의 `withoutUndeliverableCustomer`와 같은 판정이다.
 *
 * 운영자 사본(`sendSubscriptionOperatorAlert`)은 이 함수를 지나지 않는다 — 주소가 우리
 * 것이라 파기와 무관하고, 파기된 구독이라도 운영자는 무슨 일이 있었는지 알아야 한다.
 */
const sendCustomerEmail = (
  sub: Pick<Subscription, 'customerEmail'>,
  prefix: string,
  params: Parameters<typeof sendEmail>[0],
): Promise<string | null> => {
  if (isPurgedValue(sub.customerEmail)) return Promise.resolve(null);
  // errorCode가 없더라도 실패는 실패로 센다 — null을 돌려주면 파기 건과 구분되지 않는다.
  return sendEmail(params).then((r) => (r.ok ? null : `${prefix}:${r.errorCode ?? 'API_ERROR'}`));
};

const amountLine = (sub: Pick<Subscription, 'totalAmount'>): string =>
  `월 ${formatPriceAmount(sub.totalAmount)}원 (VAT 포함)`;

/**
 * 카드 등록 안내.
 *
 * **setupMode에 따라 안내가 갈린다.** 'initial'은 등록 즉시 첫 달치가 결제된다는 사실을
 * 반드시 명시해야 하고(스펙 §6), 'change'(이미 청구가 도는 구독의 카드 교체)는 결제가
 * 없다 — 한 문구로 뭉뚱그리면 둘 중 하나는 거짓이 된다. 예전에는 'change' 링크를 받은
 * 고객에게도 "즉시 첫 달치가 결제되고"라고 알려, **없는 청구를 예고**하고 있었다.
 * 등록 화면(pages/[locale]/subscribe/[id].tsx)도 같은 값으로 같은 분기를 한다.
 */
export const sendSubscriptionSetupEmail = (
  sub: Pick<Subscription, 'id' | 'kind' | 'artistSlug' | 'customerEmail' | 'customerName' | 'totalAmount' | 'billingDay' | 'setupMode' | 'status'>,
  setupUrl: string,
): Promise<string | null> => {
  const isChange = sub.setupMode === 'change';
  // 일시정지(paused) 구독은 카드를 새로 등록해도 자동으로 재개되지 않는다 —
  // listDueSubscriptions가 active·past_due만 집어 간다(lib/billing/service.ts). 그 상태에
  // "다음 결제일부터 새 카드로 청구됩니다"라고 쓰면 **오지 않을 청구를 예고**하는 것이라,
  // 바로 위 주석이 말하는 'change' 거짓 안내와 같은 종류의 거짓이 된다.
  const isPaused = sub.status === 'paused';
  return sendCustomerEmail(sub, 'setup', {
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub)} 정기결제 ${isChange ? '카드 변경' : '카드 등록'} 안내`,
    text: [
      isChange
        ? `${sub.customerName}님, ${subscriptionOrderName(sub)} 정기결제에 사용할 카드 변경을 안내드립니다.`
        : `${sub.customerName}님, ${subscriptionOrderName(sub)} 정기결제를 위한 카드 등록을 안내드립니다.`,
      `상품: ${subscriptionOrderName(sub)}`,
      `${amountLine(sub)}`,
      `결제일: 매월 ${sub.billingDay}일`,
      '',
      isChange
        ? isPaused
          ? '아래 링크에서 새 카드를 등록하시면 카드만 교체되며, 이번에는 결제되지 않습니다. 정기결제가 멈춰 있는 상태라 재개는 문의로 안내해 드립니다.'
          : '아래 링크에서 새 카드를 등록하시면 카드만 교체되며, 이번에는 결제되지 않습니다. 다음 결제일부터 새 카드로 청구됩니다.'
        : '아래 링크에서 카드를 등록하면 즉시 첫 달치가 결제되고, 이후 매월 같은 날 자동으로 결제됩니다.',
      setupUrl,
      '',
      '링크는 발급일로부터 7일간 유효합니다.',
      '문의: 010-4255-7893',
    ].join('\n'),
  });
};

/** 카드 등록 + 첫 결제 성공 확정. */
export const sendSubscriptionActivatedEmail = (
  sub: Pick<Subscription, 'kind' | 'artistSlug' | 'customerEmail' | 'customerName' | 'billingDay'>,
  input: { manageUrl: string; amount: number },
): Promise<string | null> =>
  sendCustomerEmail(sub, 'activated', {
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub)} 정기결제가 시작되었습니다`,
    text: [
      `${sub.customerName}님, 카드 등록과 첫 결제가 완료되어 정기결제가 시작되었습니다.`,
      `이번 결제: ${formatPriceAmount(input.amount)}원 (VAT 포함)`,
      `다음 결제일: 매월 ${sub.billingDay}일`,
      '',
      `구독 조회·해지: ${input.manageUrl}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  });

/** 매월 결제 완료. */
export const sendSubscriptionChargedEmail = (
  sub: Pick<Subscription, 'kind' | 'artistSlug' | 'customerEmail' | 'customerName'>,
  input: { amount: number; cycleYm: string; paymentKey?: string; manageUrl: string },
): Promise<string | null> =>
  sendCustomerEmail(sub, 'charged', {
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub)} ${input.cycleYm} 결제가 완료되었습니다`,
    text: [
      `${sub.customerName}님, ${input.cycleYm}분 ${subscriptionOrderName(sub)}가 결제되었습니다.`,
      `결제 금액: ${formatPriceAmount(input.amount)}원 (VAT 포함)`,
      '',
      `구독 조회·해지: ${input.manageUrl}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  });

/** 결제 실패 — 재시도 예정 또는 정지 안내(마지막 재시도까지 소진하면 nextRetryAt이 null). */
export const sendSubscriptionChargeFailedEmail = (
  sub: Pick<Subscription, 'kind' | 'artistSlug' | 'customerEmail' | 'customerName'>,
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

  return sendCustomerEmail(sub, 'charge_failed', {
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub)} ${input.cycleYm} 결제에 실패했습니다`,
    text: [
      `${sub.customerName}님, ${input.cycleYm}분 ${subscriptionOrderName(sub)} 결제(${formatPriceAmount(input.amount)}원)에 실패했습니다.`,
      statusLine,
      '',
      input.cardChangeHint,
      `구독 조회·카드 변경: ${input.manageUrl}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  });
};

/** 해지 확인. 즉시 환불 없이 이미 결제한 기간까지 이용 가능함을 안내한다. */
export const sendSubscriptionCancelledEmail = (
  sub: Pick<Subscription, 'kind' | 'artistSlug' | 'customerEmail' | 'customerName'>,
  input: { endsAt: Date },
): Promise<string | null> =>
  sendCustomerEmail(sub, 'cancelled', {
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub)} 정기결제가 해지되었습니다`,
    text: [
      `${sub.customerName}님, ${subscriptionOrderName(sub)} 정기결제 해지가 접수되었습니다.`,
      `${input.endsAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}까지는 계속 이용하실 수 있고, 이후 청구는 없습니다.`,
      '',
      '문의: 010-4255-7893',
    ].join('\n'),
  });

/**
 * 회차 환불 안내. 관리자가 구독 상세에서 회차를 환불했을 때 보낸다.
 *
 * 토스가 카드 취소 문자를 따로 보내지만, 그 문자에는 "왜"가 없다 — 어느 달치가 얼마나
 * 돌아가는지, 구독은 그대로인지를 우리가 말해야 고객이 문의 없이 이해한다. 구독 상태는
 * 환불로 바뀌지 않으므로(lib/billing/refund.ts) 그 사실을 함께 적는다.
 */
export const sendSubscriptionRefundedEmail = (
  sub: Pick<Subscription, 'kind' | 'artistSlug' | 'customerEmail' | 'customerName'>,
  input: { amount: number; cycleYm: string; orderNo: string; isFull: boolean; manageUrl: string },
): Promise<string | null> =>
  sendCustomerEmail(sub, 'refunded', {
    to: sub.customerEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${subscriptionOrderName(sub)} ${input.cycleYm} 결제가 ${input.isFull ? '' : '일부 '}환불되었습니다`,
    text: [
      `${sub.customerName}님, ${input.cycleYm}분 ${subscriptionOrderName(sub)} 결제(${input.orderNo})에서 ${formatPriceAmount(input.amount)}원이 결제하신 카드로 환불되었습니다.`,
      '카드사에 따라 취소 반영까지 3~7영업일이 걸릴 수 있습니다.',
      '',
      '정기결제 자체는 이번 환불로 바뀌지 않습니다. 해지나 정지가 함께 필요하면 아래 링크나 문의로 알려 주세요.',
      `구독 조회·해지: ${input.manageUrl}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  });

export type SubscriptionAlertKind =
  | 'paused'
  | 'first_charge_failed'
  | 'cancelled'
  | 'late_approval'
  | 'paused_late_approval';

/** 운영자 알림. kind는 발생 사건을 나타낸다. */
export const sendSubscriptionOperatorAlert = (
  sub: Pick<Subscription, 'id' | 'kind' | 'artistSlug' | 'customerName' | 'customerPhone'>,
  kind: SubscriptionAlertKind,
  detail: string,
): Promise<string | null> => {
  const titleByKind: Record<SubscriptionAlertKind, string> = {
    paused: '정기결제 정지',
    first_charge_failed: '첫 결제 실패',
    cancelled: '고객 해지',
    // 해지·종료된 구독에 승인이 뒤늦게 도착한 경우. 돈은 들어왔는데 이용기간은 전진하지
    // 않으므로 환불 기한이 도는 건이다 — 로그가 아니라 사람에게 닿아야 한다(PR #59의 교훈).
    late_approval: '해지 구독에 뒤늦은 승인 — 환불 판단 필요',
    // 정지된 구독에 승인이 뒤늦게 도착한 경우. 돈은 들어왔고 이용기간도 전진했지만 구독은
    // 정지 그대로다 — 운영자가 세워 둔 것을 웹훅이 말없이 되살리지 않기 위해서다
    // (`reconcileSubscriptionPaymentFromToss`). 재개할지 환불할지는 사람이 정한다.
    paused_late_approval: '정지된 구독에 뒤늦은 승인 — 재개 여부 판단 필요',
  };

  return sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[구독] ${titleByKind[kind]} — ${subscriptionOrderName(sub)} · ${sub.customerName}`,
    text: [
      `구독 ${sub.id} (${subscriptionOrderName(sub)}) — ${titleByKind[kind]}`,
      `고객: ${sub.customerName} / ${sub.customerPhone}`,
      detail,
      `관리자: ${SITE_URL}/admin/subscriptions/${sub.id}`,
    ].join('\n'),
  }).then((result) => (result.ok ? null : `operator:${result.errorCode}`));
};
