import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { formatPriceAmount } from '../../data/pricing';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import { isPurgedValue } from '../privacy/orderRetention';
import { BANK_ACCOUNT, formatKstDeadline } from './bankAccount';
import { AWAITING_DEPOSIT, DEPOSIT_CANCELLED } from './bankDeposit';
import { safeDbErrorSummary } from './refundAccount';

/**
 * 공연·예약·믹싱 **계좌 입금 주문**의 서버 공용 부품 — 같은 이름 후보, 입금 안내 메일.
 * 규칙의 근거는 lib/payments/bankDeposit.ts 머리 주석.
 */

/** 이 함수들이 다루는 주문 종류(`orders.type`). 펀딩은 자기 표로 따로 센다(lib/funding/bankTransfer.ts). */
const BANK_DEPOSIT_ORDER_TYPES = sql`('session', 'mixing', 'ticket')`;

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
  /** 입금 안내를 다시 보고 신청을 취소할 수 있는 고객 화면(관리 토큰 포함). */
  manageUrl: string;
  /** 운영자 메일에 싣는 관리자 화면 주소. */
  adminUrl: string;
}

/**
 * **입금 안내 메일** — 고객 한 통 + 운영자 접수 알림 한 통. 실패 사유를 모아 돌려준다(성공이면 null) —
 * 호출부가 `orders.notification_error`에 남겨 관리자 화면의 "입금 안내 재발송"과 헬스체크가 본다.
 *
 * 고객 주소가 파기 표식이면 보내지 않고 실패로도 세지 않는다(lib/booking/email.ts의 같은 판정).
 */
export const sendDepositGuideEmails = async (m: DepositGuideMail): Promise<string | null> => {
  const failures: string[] = [];
  const deadline = `${formatKstDeadline(m.deadline)}(한국시간)`;
  if (!isPurgedValue(m.customerEmail)) {
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
        `입금 안내 다시 보기·신청 취소: ${m.manageUrl}`,
        '문의: 010-4255-7893',
      ].join('\n'),
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
