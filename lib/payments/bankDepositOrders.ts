import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { formatPriceAmount } from '../../data/pricing';
import { adminUrl as absoluteAdminUrl, buildEmailLayout, escapeHtml, type EmailLayoutRow } from '../email/layout';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import { isPurgedValue } from '../privacy/orderRetention';
import { BANK_ACCOUNT, BANK_ACCOUNT_EN, formatKstDeadline } from './bankAccount';
import { AWAITING_DEPOSIT, DEPOSIT_CANCELLED } from './bankDeposit';
import { safeDbErrorSummary } from './refundAccount';

/**
 * 공연·예약·믹싱 **계좌 입금 주문**의 서버 공용 부품 — 같은 이름 후보, 입금 안내 메일.
 * 규칙의 근거는 lib/payments/bankDeposit.ts 머리 주석.
 */

/** 이 함수들이 다루는 주문 종류(`orders.type`). 펀딩은 자기 표로 따로 센다(lib/funding/bankTransfer.ts). */
const BANK_DEPOSIT_ORDER_TYPES = sql`('session', 'mixing', 'ticket', 'deposit')`;

export interface SameNameDepositOrder {
  id: string;
  orderNo: string;
  type: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

/**
 * 같은 이름의 **다른** 계좌 입금 주문 중 입금 대기이거나 입금 전에 닫힌 것 — 관리자 상세에 후보로 띄운다.
 * 통장의 입금 한 건을 두 신청에 이중으로 확인하는 사고를 막는다(SAF2026 2026-09-08). 종류(공연·예약·믹싱)로
 * 좁히지 않고, 이름은 정확히 같을 때만 본다(앞뒤 공백 무시). 최신순 10건. 조회 실패는 빈 목록 — 보조 정보다.
 */
export const findSameNameDepositOrders = async (order: { id: string; customerName: string }): Promise<SameNameDepositOrder[]> => {
  try {
    const rows = await getDb().all<{ id: string; order_no: string; type: string; status: string; total_amount: number; created_at: number }>(sql`
      SELECT id, order_no, type, status, total_amount, created_at FROM orders
      WHERE id != ${order.id} AND type IN ${BANK_DEPOSIT_ORDER_TYPES}
        AND TRIM(customer_name) = TRIM(${order.customerName})
        AND status IN (${AWAITING_DEPOSIT}, ${DEPOSIT_CANCELLED})
      ORDER BY created_at DESC LIMIT 10
    `);
    return rows.map((r) => ({
      id: r.id, orderNo: r.order_no, type: r.type, status: r.status,
      totalAmount: Number(r.total_amount), createdAt: new Date(Number(r.created_at) * 1000).toISOString(),
    }));
  } catch (error) {
    // 바인딩 값에 고객 이름이 실린다 — 요지만 남긴다.
    console.error('[bank-deposit] 같은 이름 신청 조회 실패', { orderId: order.id, error: safeDbErrorSummary(error) });
    return [];
  }
};

export interface DepositGuideMail {
  orderNo: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  deadline: Date;
  /** 메일 제목 뒤에 붙는 말 — "공연 예매", "연습실 예약" 등. */
  kindLabel: string;
  /** "예매하신 분"·"예약하신 분"·"주문하신 분". */
  applicantLabel: string;
  /** 무엇을 신청했는지 몇 줄(공연·일시·매수 / 상품·일시 / 상품·곡 수). */
  summaryLines: string[];
  /** 입금 안내를 다시 보고 신청을 취소할 수 있는 고객 화면(관리 토큰 포함). 그런 화면이 없는 주문(예약금 링크)은 비운다. */
  manageUrl?: string;
  /** 운영자 메일에 싣는 관리자 화면 주소. */
  adminUrl: string;
  /** 고객 안내 메일을 보내지 않는다(같은 주소 발송 상한에 걸린 경우). 운영자 알림은 그대로 간다. */
  skipCustomer?: boolean;
  /**
   * 고객 메일 언어 — 공연 영어 화면(/en/shows)으로 신청한 주문만 'en'. 그때 고객 메일은 `customerSummaryLines`
   * (영어 "Show: …")를 쓰고, 운영자 알림은 언제나 한국어 `summaryLines`다.
   */
  customerLocale?: 'ko' | 'en';
  customerSummaryLines?: string[];
  /** 영어 고객 메일의 kindLabel·applicantLabel(운영자 알림은 위 한국어 값을 쓴다). */
  customerKindLabel?: string;
  customerApplicantLabel?: string;
}

/**
 * `summaryLines`를 표 행과 문장으로 가른다 — "공연: ○○"처럼 짧은 라벨이 붙은 줄은 행, 나머지는 문장.
 * (호출부가 text용으로 넘긴 줄을 HTML에서도 그대로 쓰기 위함이다.)
 */
const splitSummaryLines = (lines: string[]): { rows: EmailLayoutRow[]; sentences: string[] } => {
  const rows: EmailLayoutRow[] = [];
  const sentences: string[] = [];
  for (const line of lines) {
    const match = /^([^:\s]{1,10}):\s+(.+)$/.exec(line);
    if (match) rows.push({ label: match[1], value: match[2] });
    else if (line.trim()) sentences.push(line);
  }
  return { rows, sentences };
};

/** 운영자 메일의 관리자 링크 — 이미 절대 주소면 그대로, 경로면 사이트 주소를 붙인다. */
const toAbsoluteAdminUrl = (url: string): string => (/^https?:\/\//.test(url) ? url : absoluteAdminUrl(url));

const EN_DEADLINE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

/** 고객 입금 안내 메일의 영어판 — 아래 한국어 고객 메일과 같은 구성·같은 사실. 순수 함수. */
export const buildDepositGuideCustomerEmailEn = (m: DepositGuideMail): { subject: string; text: string; html: string } => {
  const deadline = `${EN_DEADLINE.format(m.deadline)} (KST)`;
  const amount = `₩${formatPriceAmount(m.totalAmount)}`;
  const lines = m.customerSummaryLines ?? m.summaryLines;
  const summary = splitSummaryLines(lines);
  const bank = `${BANK_ACCOUNT_EN.bankName} (${BANK_ACCOUNT.bankName})`;
  const nameLine = `Please send the transfer under the name of the ${m.customerApplicantLabel ?? 'person who booked'} (${m.customerName}). We match it by name and amount.`;
  return {
    subject: `[Studio NOL] Bank transfer details — ${m.customerKindLabel ?? 'your booking'}`,
    text: [
      `Hi ${m.customerName}, thank you for your booking.`,
      'Please transfer the amount to the account below. We will confirm it once we see the transfer.',
      '',
      `Bank: ${bank}`,
      `Account number: ${BANK_ACCOUNT.accountNumber}`,
      `Account holder: ${BANK_ACCOUNT_EN.accountHolder}`,
      `Amount: ${amount}`,
      '',
      nameLine,
      `Please transfer by ${deadline}. We will email you once the transfer is confirmed (within 1 business day).`,
      '',
      ...lines,
      `Order no.: ${m.orderNo}`,
      '',
      ...(m.manageUrl ? [`View these details again / cancel: ${m.manageUrl}`] : []),
      'Contact: +82 10-4255-7893 · hello@studionol.co.kr',
    ].join('\n'),
    html: buildEmailLayout({
      locale: 'en',
      preheader: `Please transfer ${amount} by ${deadline}.`,
      heading: 'Bank transfer details',
      paragraphs: [
        `Hi ${escapeHtml(m.customerName)}, thank you for your booking.`,
        'Please transfer the amount to the account below. We will confirm it once we see the transfer.',
      ],
      rows: [
        { label: 'Bank', value: bank },
        { label: 'Account number', value: BANK_ACCOUNT.accountNumber, emphasis: true },
        { label: 'Account holder', value: BANK_ACCOUNT_EN.accountHolder },
        { label: 'Amount', value: amount, emphasis: true },
        { label: 'Transfer by', value: deadline },
        ...summary.rows,
        { label: 'Order no.', value: m.orderNo },
      ],
      ...(m.manageUrl ? { cta: { label: 'View details / cancel request', url: m.manageUrl } } : {}),
      notices: [
        escapeHtml(nameLine),
        'We will email you once the transfer is confirmed (within 1 business day).',
        ...summary.sentences.map(escapeHtml),
        'Contact: +82 10-4255-7893 · hello@studionol.co.kr',
      ],
    }),
  };
};

/**
 * **입금 안내 메일** — 고객 한 통 + 운영자 접수 알림 한 통. 실패 사유를 모아 돌려준다(성공이면 null) —
 * 호출부가 `orders.notification_error`에 남겨 관리자 화면의 "입금 안내 재발송"과 헬스체크가 본다.
 *
 * 고객 주소가 파기 표식이면 보내지 않고 실패로도 세지 않는다(lib/booking/email.ts의 같은 판정).
 */
export const sendDepositGuideEmails = async (m: DepositGuideMail): Promise<string | null> => {
  const failures: string[] = [];
  const deadline = `${formatKstDeadline(m.deadline)}(한국시간)`;
  const summary = splitSummaryLines(m.summaryLines);
  if (!m.skipCustomer && !isPurgedValue(m.customerEmail) && m.customerLocale === 'en') {
    const r = await sendEmail({ to: m.customerEmail, replyTo: CUSTOMER_REPLY_TO, ...buildDepositGuideCustomerEmailEn(m) });
    if (!r.ok) failures.push(`customer:${r.errorCode ?? 'API_ERROR'}`);
  } else if (!m.skipCustomer && !isPurgedValue(m.customerEmail)) {
    const r = await sendEmail({
      to: m.customerEmail, replyTo: CUSTOMER_REPLY_TO,
      subject: `[스튜디오 놀] 계좌 입금 안내 — ${m.kindLabel}`,
      text: [
        `${m.customerName}님, 신청해 주셔서 고맙습니다.`,
        '아래 계좌로 입금해 주시면 확인한 뒤 확정해 드립니다.',
        '',
        `은행: ${BANK_ACCOUNT.bankName}`,
        `계좌번호: ${BANK_ACCOUNT.accountNumber}`,
        `예금주: ${BANK_ACCOUNT.accountHolder}`,
        `입금하실 금액: ${formatPriceAmount(m.totalAmount)}원`,
        '',
        `입금하실 때 보내는 분 이름은 ${m.applicantLabel} 성함(${m.customerName})으로 해 주세요. 이름과 금액으로 확인합니다.`,
        `${deadline}까지 입금해 주세요. 입금이 확인되면 메일로 알려 드립니다(영업일 1일 이내).`,
        '',
        ...m.summaryLines,
        `주문번호: ${m.orderNo}`,
        '',
        ...(m.manageUrl ? [`입금 안내 다시 보기·신청 취소: ${m.manageUrl}`] : []),
        '문의: 010-4255-7893',
      ].join('\n'),
      html: buildEmailLayout({
        preheader: `${formatPriceAmount(m.totalAmount)}원을 ${deadline}까지 입금해 주세요.`,
        heading: '계좌 입금 안내',
        paragraphs: [
          `${escapeHtml(m.customerName)}님, 신청해 주셔서 고맙습니다.`,
          '아래 계좌로 입금해 주시면 확인한 뒤 확정해 드립니다.',
        ],
        rows: [
          { label: '은행', value: BANK_ACCOUNT.bankName },
          { label: '계좌번호', value: BANK_ACCOUNT.accountNumber, emphasis: true },
          { label: '예금주', value: BANK_ACCOUNT.accountHolder },
          { label: '입금하실 금액', value: `${formatPriceAmount(m.totalAmount)}원`, emphasis: true },
          { label: '입금 기한', value: deadline },
          ...summary.rows,
          { label: '주문번호', value: m.orderNo },
        ],
        ...(m.manageUrl ? { cta: { label: '입금 안내 다시 보기·신청 취소', url: m.manageUrl } } : {}),
        notices: [
          `입금하실 때 보내는 분 이름은 ${escapeHtml(m.applicantLabel)} 성함(<strong>${escapeHtml(m.customerName)}</strong>)으로 해 주세요. 이름과 금액으로 확인합니다.`,
          '입금이 확인되면 메일로 알려 드립니다(영업일 1일 이내).',
          ...summary.sentences.map(escapeHtml),
          '문의: 010-4255-7893',
        ],
      }),
    });
    if (!r.ok) failures.push(`customer:${r.errorCode ?? 'API_ERROR'}`);
  }
  const op = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[${m.kindLabel}] 계좌 입금 신청 ${formatPriceAmount(m.totalAmount)}원 — ${m.customerName}`,
    text: [
      '통장에 입금이 들어오면 관리자 화면에서 "입금 확인"을 눌러 주세요. 자동 취소는 없습니다.',
      ...m.summaryLines,
      `고객: ${m.customerName} / ${m.customerPhone} / ${m.customerEmail}`,
      `금액: ${formatPriceAmount(m.totalAmount)}원`,
      `안내한 기한: ${deadline}`,
      `주문번호: ${m.orderNo}`,
      `관리자: ${m.adminUrl}`,
    ].join('\n'),
    html: buildEmailLayout({
      audience: 'operator',
      noticeTone: 'alert',
      preheader: `${m.customerName} · ${formatPriceAmount(m.totalAmount)}원 · ${m.kindLabel}`,
      heading: `${m.kindLabel} 계좌 입금 신청이 접수되었습니다`,
      rows: [
        { label: '고객', value: m.customerName },
        { label: '연락처', value: m.customerPhone, href: `tel:${m.customerPhone.replace(/[^0-9+]/g, '')}` },
        { label: '이메일', value: m.customerEmail, href: `mailto:${m.customerEmail}` },
        ...summary.rows,
        { label: '금액', value: `${formatPriceAmount(m.totalAmount)}원`, emphasis: true },
        { label: '안내한 기한', value: deadline },
        { label: '주문번호', value: m.orderNo },
      ],
      cta: { label: '관리자에서 보기', url: toAbsoluteAdminUrl(m.adminUrl) },
      notices: [
        '통장에 입금이 들어오면 관리자 화면에서 <strong>"입금 확인"</strong>을 눌러 주세요. 자동 취소는 없습니다.',
        ...summary.sentences.map(escapeHtml),
      ],
    }),
  });
  if (!op.ok) failures.push(`operator:${op.errorCode ?? 'API_ERROR'}`);
  return failures.length ? failures.join(', ') : null;
};

/**
 * 입금 안내 발송 결과를 `notification_error`에 남긴다 — **입금 대기 중일 때만**(그 사이 확정·취소됐으면
 * 그 경로가 쓴 값을 덮지 않는다). 실패는 삼키고 로그만.
 */
export const recordDepositGuideResult = async (orderId: string, value: string | null): Promise<void> => {
  try {
    await getDb().run(sql`UPDATE orders SET notification_error = ${value} WHERE id = ${orderId} AND status = ${AWAITING_DEPOSIT}`);
  } catch (error) {
    console.error('[bank-deposit] 입금 안내 결과 기록 실패', { orderId, value, error: safeDbErrorSummary(error) });
  }
};

/** libSQL 결과의 rowsAffected(없으면 0). */
export const rowsOf = (result: unknown): number => {
  const n = Number((result as { rowsAffected?: unknown } | undefined)?.rowsAffected ?? 0);
  return Number.isFinite(n) ? n : 0;
};
