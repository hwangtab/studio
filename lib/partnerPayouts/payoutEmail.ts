import { formatPriceAmount } from '../../data/pricing';
import { adminUrl, buildEmailLayout, escapeHtml, type EmailLayoutRow } from '../email/layout';
import { sendEmail } from '../email/resend';
import { accountValue } from '../funding/payoutEmail';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

import type { PartnerPayout } from '../../db/schema';
import type { FundingPayoutAccountMasked } from '../funding/payoutAccount';

/**
 * 상점·공연 정산 알림 메일 — 펀딩 `lib/funding/payoutEmail.ts`와 같은 틀이다. 수신자는 수취인(개설자) 하나, 운영자는 버튼을 누른 당사자라 이미 안다.
 * **종류(shop/show)를 가리지 않는다** — 기록 행(`partner_payouts`)의 숫자 칸만 읽고, 칸이 0이면 그 줄을 뺀다. 공연(P2)의 행도 그대로 흘러든다.
 *
 * 규칙(펀딩과 같다 — 바꾸려면 펀딩 쪽과 처리방침 14·19항을 함께 본다):
 * - **계좌는 은행명·예금주·뒤 4자리뿐이다.** 메일은 전달·보관되는 문서라 번호 전체를 싣지 않는다.
 * - **운영자 메모는 「지급 완료」 메일에만 싣는다.** 메모는 이체일·실제 보낸 금액을 적는 칸이고 그 시점에 쓰인다(처리방침 14항: "정산 안내 메일에 그대로 실립니다").
 *   그래서 메모에는 수취인에게 보여도 되는 말만 적는다 — 화면의 메모 입력 문구가 그렇게 안내한다.
 * - 요율은 적지 않는다. 기록 행은 금액만 고정하고 요율 칸이 없어, 그 사이 상수가 바뀌면 기록된 금액 옆에 안 맞는 요율이 찍힌다.
 * - 발송 실패는 사유 문자열로 돌려줄 뿐 던지지 않는다 — 호출부가 warnings로 화면에 올리고 운영자 폴백 알림을 보낸다.
 */

export type PartnerPayoutNoticeEvent = 'recorded' | 'paid';

const won = (n: number): string => `${formatPriceAmount(n)}원`;
const signedWon = (n: number): string => `${n < 0 ? '−' : '+'}${formatPriceAmount(Math.abs(n))}원`;

/** 메일에 적는 정산 이름. 상점은 달, 공연은 공연 제목(모르면 일반 이름). */
export const payoutNoticeTitle = (payout: Pick<PartnerPayout, 'kind' | 'period'>, showTitle?: string | null): string =>
  payout.kind === 'shop' ? `${payout.period} 상점 판매 정산` : showTitle ? `"${showTitle}" 공연 정산` : '공연 정산';

/** 계산 내역 — 합계만 보내면 왜 그 금액인지 알 수 없고 그 질문이 문의가 된다. 0인 칸은 뺀다. */
export const payoutNoticeRows = (payout: PartnerPayout): EmailLayoutRow[] => [
  { label: '판매액', value: won(payout.grossAmount) },
  ...(payout.refundAmount > 0 ? [{ label: '환불', value: `−${won(payout.refundAmount)}` }] : []),
  ...(payout.shippingAmount > 0 ? [{ label: '배송비(직접 발송)', value: `+${won(payout.shippingAmount)}` }] : []),
  ...(payout.platformFeeAmount > 0 ? [{ label: '플랫폼 수수료', value: `−${won(payout.platformFeeAmount)}` }] : []),
  ...(payout.paymentFeeAmount > 0 ? [{ label: '결제 수수료', value: `−${won(payout.paymentFeeAmount)}` }] : []),
  // 상점의 스튜디오 몫(위탁 판매 수수료). 공연은 위 두 수수료가 대신하므로 이 칸을 싣지 않는다.
  ...(payout.kind === 'shop' && payout.studioAmount > 0 ? [{ label: '스튜디오 몫', value: `−${won(payout.studioAmount)}` }] : []),
  ...(payout.vatDeductionAmount > 0 ? [{ label: '부가세 상당액(개인 정산)', value: `−${won(payout.vatDeductionAmount)}` }] : []),
  ...(payout.withholdingAmount > 0 ? [{ label: '원천징수', value: `−${won(payout.withholdingAmount)}` }] : []),
  ...(payout.adjustmentAmount !== 0 ? [{ label: '이월 조정(정산 뒤 환불 등)', value: signedWon(payout.adjustmentAmount) }] : []),
  { label: '실지급액', value: won(payout.netAmount), emphasis: true },
  ...(payout.shortfallAmount > 0
    ? [{
        label: '정산금으로 충당하지 못한 금액',
        value: payout.kind === 'shop' ? `${won(payout.shortfallAmount)} — 다음 정산으로 이월돼요.` : `${won(payout.shortfallAmount)} — 따로 상의드려요.`,
      }]
    : []),
];

const rowLines = (payout: PartnerPayout): string[] => payoutNoticeRows(payout).map((row) => `${row.label}: ${row.value}`);

const COPY = {
  recorded: {
    subject: (title: string) => `[스튜디오 놀] 정산 내역을 알려 드려요 — ${title}`,
    heading: '정산 내역을 알려 드려요',
    lead: (title: string) => `${title}의 정산 금액이 확정됐어요.`,
    notice: '이체가 끝나면 다시 알려 드려요. 금액이나 계좌가 다르면 이체 전에 알려 주세요.',
    preheader: (title: string, p: PartnerPayout) => `${title} — 실지급액 ${won(p.netAmount)}`,
  },
  paid: {
    subject: (title: string) => `[스튜디오 놀] 정산금을 보냈어요 — ${title}`,
    heading: '정산금을 보냈어요',
    lead: (title: string) => `${title}의 정산금을 보냈어요.`,
    notice: '입금이 확인되지 않으면 알려 주세요.',
    preheader: (title: string, p: PartnerPayout) => `${title} — ${won(p.netAmount)}을 보냈어요.`,
  },
} as const;

export const buildPartnerPayoutNoticeText = (
  event: PartnerPayoutNoticeEvent,
  title: string,
  payout: PartnerPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  [
    COPY[event].lead(title),
    '',
    ...rowLines(payout),
    '',
    `입금 계좌: ${accountValue(account)}`,
    ...(event === 'paid' && payout.memo ? ['', `메모: ${payout.memo}`] : []),
    '',
    COPY[event].notice,
    `문의: ${CUSTOMER_REPLY_TO}`,
  ].join('\n');

export const buildPartnerPayoutNoticeHtml = (
  event: PartnerPayoutNoticeEvent,
  title: string,
  payout: PartnerPayout,
  account: FundingPayoutAccountMasked | null,
): string =>
  buildEmailLayout({
    preheader: COPY[event].preheader(title, payout),
    heading: COPY[event].heading,
    paragraphs: [escapeHtml(COPY[event].lead(title))],
    rows: [
      ...payoutNoticeRows(payout),
      { label: '입금 계좌', value: accountValue(account) },
      ...(event === 'paid' && payout.memo ? [{ label: '메모', value: payout.memo }] : []),
    ],
    notices: [COPY[event].notice, `문의: ${escapeHtml(CUSTOMER_REPLY_TO)}`],
  });

export const sendPartnerPayoutNoticeEmail = async (
  to: string,
  event: PartnerPayoutNoticeEvent,
  title: string,
  payout: PartnerPayout,
  account: FundingPayoutAccountMasked | null,
): Promise<string | null> => {
  const result = await sendEmail({
    to,
    replyTo: CUSTOMER_REPLY_TO,
    subject: COPY[event].subject(title),
    text: buildPartnerPayoutNoticeText(event, title, payout, account),
    html: buildPartnerPayoutNoticeHtml(event, title, payout, account),
  });
  return result.ok ? null : `payee:${result.errorCode}`;
};

/**
 * 수취인 메일이 실패했을 때 운영자에게 알린다. 실패는 HTTP 응답의 warnings에만 남고 운영자가 탭을 닫으면 사라진다 —
 * 기록·지급은 정산당 한 번이라 다시 눌러 재발송할 수도 없다(펀딩과 같은 이유).
 */
export const sendPartnerPayoutOperatorFallback = async (
  payout: Pick<PartnerPayout, 'kind' | 'period' | 'subjectKey' | 'payeeName'>,
  title: string,
  what: '정산 기록' | '정산 지급',
  payeeEmail: string,
  reason: string,
): Promise<string | null> => {
  const adminPath = payout.kind === 'shop' ? `/admin/shop?month=${encodeURIComponent(payout.period)}` : `/admin/shows/${encodeURIComponent(payout.subjectKey)}`;
  const label = payout.kind === 'shop' ? '상점' : '공연';
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[${label} 정산] ${what} 알림 메일 발송 실패 — ${payout.payeeName} ${title}`,
    text: [
      `${what}은 정상 처리됐지만 수취인에게 보내는 알림 메일이 실패했어요.`,
      `수취인: ${payout.payeeName}`,
      `수신 시도 주소: ${payeeEmail}`,
      `실패 사유: ${reason}`,
      '',
      '수취인은 이 사실을 몰라요. 위 주소로 직접 알려 주세요.',
      '',
      `관리자 화면: ${adminUrl(adminPath)}`,
    ].join('\n'),
    html: buildEmailLayout({
      audience: 'operator',
      noticeTone: 'alert',
      preheader: `${payout.payeeName} · ${what} 알림 메일 발송 실패`,
      heading: `${what} 알림 메일 발송 실패`,
      rows: [
        { label: '수취인', value: payout.payeeName },
        { label: '정산', value: title },
        { label: '수신 시도 주소', value: payeeEmail, href: `mailto:${payeeEmail}` },
        { label: '실패 사유', value: reason },
      ],
      cta: { label: '관리자 화면 열기', url: adminUrl(adminPath) },
      notices: [`${escapeHtml(what)}은 정상 처리됐지만 수취인에게 보내는 알림 메일이 실패했어요. 수취인은 이 사실을 몰라요. 위 주소로 직접 알려 주세요.`],
    }),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};
