import { formatPriceAmount } from '../../data/pricing';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { formatKstDateTimeFull } from '../booking/format';
import { BANK_ACCOUNT } from './policy';
import type { FundingProject } from './projects';
import type { FundingOrder } from './service';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const manageUrl = (order: FundingOrder): string => `${SITE_URL}/ko/funding/manage/${order.orderNo}?token=${order.manageToken}`;
const PHONE_NUMBER = '010-4255-7893';
const PHONE = `문의: ${PHONE_NUMBER}`;

/**
 * 제목 꼬리표. 프로젝트를 못 찾으면(슬러그 오타·비공개 전환) `project?.title ?? ''`가
 * 빈 문자열이 되어 "후원이 확정되었습니다 — "처럼 em dash로 끝나는 제목이 나갔다.
 */
const titleSuffix = (project: FundingProject | null): string => (project?.title ? ` — ${project.title}` : '');

/** 운영자 메일용 결제수단 라벨 — 원문 enum(toss·bank_transfer)을 그대로 보이지 않는다. */
const PAYMENT_METHOD_LABEL: Record<string, string> = { toss: '토스', bank_transfer: '무통장' };
const paymentMethodLabel = (method: string | null | undefined): string =>
  (method && PAYMENT_METHOD_LABEL[method]) || method || '미지정';

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

/**
 * 전자상거래법 제13조 2항의 계약내용 서면 교부 — 계약이 성립한 뒤 후원자에게 도달하는 문서에는
 * 청약철회의 기한·행사 방법과 약관을 함께 담아야 한다. 전에는 확정·무통장 메일 어디에도 약관
 * 링크가 없어, 계약 성립 뒤 후원자가 받는 모든 문서에서 철회 조건이 사라졌다.
 * 문구는 펀딩 약관 제8조(청약철회 기간)·제10조(환불)를 그대로 요약한 것이다 — 조항을 고치면
 * 여기도 함께 고쳐야 한다(lib/funding/email.test.ts가 기한·링크를 단언한다).
 */
const withdrawalLines = (order: FundingOrder): string[] => [
  '',
  '[청약철회 안내]',
  '· 기한: 프로젝트 마감 전이고 리워드 발송 준비가 시작되기 전이면 언제든 취소하고 전액 환불받을 수 있습니다. 리워드를 받은 뒤에는 받은 날부터 7일 이내에 청약철회할 수 있습니다(표시·광고와 다르거나 계약 내용과 다르게 이행된 경우에는 받은 날부터 3개월 이내, 그 사실을 안 날부터 30일 이내).',
  `· 방법: 후원 확인 페이지(${manageUrl(order)})에서 직접 취소하거나, 이 메일에 회신 또는 ${OPERATOR_EMAIL} · ${PHONE_NUMBER}으로 알려 주세요. 환불은 접수일부터 3영업일 이내에 처리합니다.`,
  `· 약관 전문(청약철회·환불 규정 포함): ${SITE_URL}/ko/funding/terms`,
];

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
      subject: `[스튜디오 놀] 후원이 확정되었습니다${titleSuffix(project)}`,
      text: [`${order.customerName}님, 후원해 주셔서 고맙습니다.`, ...summaryLines(order, project), ...withdrawalLines(order), '', `후원 확인·취소: ${manageUrl(order)}`, PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 후원 확정 ${formatPriceAmount(order.totalAmount)}원 — ${order.customerName}`,
      text: [...summaryLines(order, project), `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
        `결제수단: ${paymentMethodLabel(order.fundingPledge?.paymentMethod)}`, `메시지: ${order.fundingPledge?.supporterMessage ?? '없음'}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);

export const sendFundingBankDepositEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null> => {
  const pledge = order.fundingPledge;
  if (!pledge) return Promise.resolve('missing_pledge');
  return send([
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: OPERATOR_EMAIL,
      subject: `[스튜디오 놀] 무통장입금 안내${titleSuffix(project)}`,
      text: [
        `${order.customerName}님, 아래 계좌로 입금해 주시면 후원이 확정됩니다.`,
        `계좌: ${BANK_ACCOUNT.bank} ${BANK_ACCOUNT.number} (${BANK_ACCOUNT.holder})`,
        `금액: ${formatPriceAmount(order.totalAmount)}원`,
        `입금자명: ${order.customerName} (후원 신청 이름과 같게 해 주세요)`,
        `입금 기한: ${formatKstDateTimeFull(pledge.holdExpiresAt.toISOString())} — 기한이 지나면 자동 취소됩니다`,
        ...summaryLines(order, project), ...withdrawalLines(order), '', `후원 확인: ${manageUrl(order)}`, PHONE,
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
      subject: `[스튜디오 놀] ${CANCEL_SUBJECT[mode]}${titleSuffix(project)}`,
      text: [`${order.customerName}님,`, CANCEL_BODY[mode](refundAmount), ...summaryLines(order, project), PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] ${CANCEL_SUBJECT[mode]} — ${order.customerName} (${mode})`,
      text: [...summaryLines(order, project), `환불 금액: ${formatPriceAmount(refundAmount)}원`, `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);
