import { sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { productionContractPaymentLinks } from '../../../db/schema';
import { closePaymentLink, createPaymentLink } from '../../payments/paymentLinks';
import { findStage, parseEventData } from './ledger';
import { loadProgressContext, recordProgressEvent, sendEventNotice } from './progress';
import { contractNameFor, paymentPurposeWord } from './terms';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';

/**
 * 계약 대금을 결제 링크(`/ko/pay/<slug>`)로 받는다 — 카드·간편결제·계좌 직접 입금을 결제 링크가 그대로 처리한다
 * (결제수단 목록·실패 화면·입금 확인·환불 기록·매출 집계·CSV). 계약 쪽은 "지금 받을 돈"에 맞는 링크를 하나 열어 두고,
 * 결제가 확정되면 진행 기록에 입금을 남긴다.
 *
 * ## 지금 받을 돈
 * - 대금(계약금)을 아직 다 받지 않았으면 → `deposit`: 계약금 − 받은 금액(일시불 계약이면 계약금 = 계약금액).
 * - 계약금을 받았고 편곡이 승인됐는데 2차가 남았으면 → `second`: 계약금 + 2차 − 받은 금액(일부 입금은 다음 링크에서 뺀다).
 * - 2차가 없거나 이미 받았고, 마스터링이 승인됐으면(잔금 기한이 생겼으면) → `balance`: 총액(추가 비용·초과 수정 요금 포함) − 받은 금액.
 * - 그 밖(작업 중·다 받음·끝난 계약) → 없음.
 *
 * 금액이 바뀌면(운영자가 계좌 입금을 직접 기록, 추가 비용 동의 등) 열려 있던 링크를 닫고 새로 만든다 — 결제 링크는 금액을 바꿀
 * 수 없고(paymentLinks.ts), 열린 링크가 남으면 이미 받은 돈을 또 받는다. 결제가 끝난 링크도 바로 닫는다(링크는 여러 번 결제된다).
 *
 * 모든 함수는 실패를 삼킨다 — 표가 없는 DB(0079 전)·일시 장애에서도 서명·체결·진행 기록은 그대로 돈다(링크가 안 보일 뿐).
 */

export type ContractPaymentLinkPurpose = 'deposit' | 'second' | 'balance';

export interface ContractPaymentLink {
  url: string;
  slug: string;
  purpose: ContractPaymentLinkPurpose;
  amount: number;
}

const urlOf = (slug: string) => `${SITE_URL}/ko/pay/${slug}`;

type Due = { purpose: ContractPaymentLinkPurpose; amount: number } | null;

/** 진행 장부로 "지금 받을 돈"을 정한다(위 주석). */
const dueNow = (context: NonNullable<Awaited<ReturnType<typeof loadProgressContext>>>): Due => {
  const { contract, terms, ledger } = context;
  if (contract.status !== 'signed' || contract.purgedAt) return null;
  const { payments } = ledger;
  if (!payments.depositMetAt) {
    const amount = Math.max(0, terms.amount.deposit - payments.received);
    return amount > 0 ? { purpose: 'deposit', amount } : null;
  }
  // 2차는 편곡 승인 뒤에만 연다 — 승인 전에 열면 아직 만들지도 않은 결과물의 대금을 먼저 받는다. 편곡이 범위 밖인
  // 계약(믹싱·마스터링)은 2차가 없으므로(second === 0) 이 갈래를 지나지 않는다.
  const secondDue = terms.amount.second > 0 && !payments.secondMetAt;
  if (secondDue && findStage(ledger, 'arrangement')?.approved) {
    const amount = Math.max(0, terms.amount.deposit + terms.amount.second - payments.received);
    return amount > 0 ? { purpose: 'second', amount } : null;
  }
  // 잔금은 2차가 없거나 이미 다 받았을 때만. 2차가 남아 있는데 잔금 기한이 먼저 생겨도 2차를 건너뛰지 않는다.
  if ((terms.amount.second === 0 || payments.secondMetAt) && payments.balanceLastDay && !payments.paidInFull) {
    const amount = Math.max(0, payments.totalDue - payments.received);
    return amount > 0 ? { purpose: 'balance', amount } : null;
  }
  return null;
};

const openLinksOf = async (contractId: string) =>
  getDb().all<{ slug: string; purpose: ContractPaymentLinkPurpose; amount: number }>(sql`
    SELECT m.slug, m.purpose, m.amount FROM production_contract_payment_links m
    JOIN payment_links l ON l.slug = m.slug
    WHERE m.contract_id = ${contractId} AND l.closed_at IS NULL
  `);

/**
 * 지금 받을 돈에 맞는 결제 링크를 열어 두고 돌려준다(없으면 null). 같은 목적·같은 금액의 열린 링크가 있으면 그것을, 아니면
 * 열린 링크를 모두 닫고 새로 만든다. 체결 직후(finalize)·완료·진행 화면·기한 안내·입금 기록 뒤에 부른다 — 여러 번 불러도 같다.
 */
export const ensureContractPaymentLink = async (contractId: string, now: Date = new Date()): Promise<ContractPaymentLink | null> => {
  try {
    const context = await loadProgressContext(contractId, now);
    if (!context) return null;
    const due = dueNow(context);
    const open = await openLinksOf(contractId);
    const keep = due ? open.find((l) => l.purpose === due.purpose && l.amount === due.amount) : undefined;
    for (const link of open) if (link !== keep) await closePaymentLink(link.slug, now);
    if (!due) return null;
    if (keep) return { url: urlOf(keep.slug), slug: keep.slug, purpose: keep.purpose, amount: keep.amount };

    const { contract, terms } = context;
    const purposeWord = paymentPurposeWord(due.purpose, terms);
    const itemName = `${contractNameFor(contract.kind).replace(/서$/, '')} ${purposeWord}`;
    const { slug } = await createPaymentLink({
      itemName,
      totalAmount: due.amount,
      expiresOn: null,
      memo: `계약 ${contract.id.slice(0, 8)}${contract.clientName ? ` · ${contract.clientName}` : ''}`,
      sessionAt: null,
      sessionHours: null,
      blockSlot: false,
    });
    await getDb().insert(productionContractPaymentLinks).values({ slug, contractId, purpose: due.purpose, amount: due.amount });
    return { url: urlOf(slug), slug, purpose: due.purpose, amount: due.amount };
  } catch (error: unknown) {
    console.error('[contracts/production/payment-link] 결제 링크를 준비하지 못했다 — 계약은 그대로 진행한다', { contractId, error });
    return null;
  }
};

/** 계약을 끝내거나(해지·취소) 다 받았을 때 열린 링크를 닫는다. */
export const closeContractPaymentLinks = async (contractId: string, now: Date = new Date()): Promise<void> => {
  try {
    for (const link of await openLinksOf(contractId)) await closePaymentLink(link.slug, now);
  } catch (error: unknown) {
    console.error('[contracts/production/payment-link] 결제 링크를 닫지 못했다', { contractId, error });
  }
};

export type ContractPaymentRecordOutcome = 'recorded' | 'not_contract' | 'already' | 'refused' | 'failed';

/**
 * 결제 링크 주문이 확정되면(카드·간편결제 승인, 운영자의 계좌 입금 확인) 그 주문이 계약 결제 링크였는지 보고, 맞으면 계약
 * 진행 기록에 입금(`payment_received`)을 남긴다. 같은 주문은 한 번만(data.orderNo로 판정 — 웹훅·승인 화면이 같은 주문을 두 번
 * 확정해도). 기록은 판정을 거치는 `recordProgressEvent`로만 넣는다(CLAUDE.md). 그다음:
 * - 의뢰인 통지 메일("입금을 확인했어요" — 남은 금액·기한이 담긴 계약 메일). 결제 링크의 일반 입금 확인 메일은 계약 결제에는
 *   보내지 않는다(호출부 — 두 통이 가지 않게).
 * - 결제된 링크를 닫고 다음에 받을 돈의 링크를 맞춘다.
 */
export const recordContractPaymentFromLinkOrder = async (orderNo: string, now: Date = new Date()): Promise<ContractPaymentRecordOutcome> => {
  try {
    const rows = await getDb().all<{ contract_id: string; slug: string; total_amount: number; approved_at: number | null }>(sql`
      SELECT m.contract_id, m.slug, o.total_amount,
             (SELECT MIN(p.approved_at) FROM payments p WHERE p.order_id = o.id AND p.approved_at IS NOT NULL) AS approved_at
      FROM payment_link_orders plo
      JOIN production_contract_payment_links m ON m.slug = plo.slug
      JOIN orders o ON o.order_no = plo.order_no
      WHERE plo.order_no = ${orderNo}
    `);
    const row = rows[0];
    if (!row) return 'not_contract';

    const context = await loadProgressContext(row.contract_id, now);
    if (!context) return 'failed';
    if (context.ledger.events.some((e) => e.type === 'payment_received' && parseEventData(e).orderNo === orderNo)) {
      await closePaymentLink(row.slug, now);
      return 'already';
    }

    const result = await recordProgressEvent(
      row.contract_id,
      {
        type: 'payment_received',
        stage: null,
        song: null,
        amount: Number(row.total_amount),
        occurredAt: row.approved_at ? new Date(Number(row.approved_at) * 1000) : now,
        data: { orderNo, note: '결제 페이지에서 결제' },
        voidsEventId: null,
      },
      { actor: 'system:payment', ip: null },
    );
    // 결제된 링크는 결과와 무관하게 닫는다 — 한 번 더 결제되는 일이 더 나쁘다.
    await closePaymentLink(row.slug, now);
    if (!result.ok) {
      console.error('[contracts/production/payment-link] 결제는 됐지만 계약 기록이 거절됐다 — 관리자 확인 필요', { orderNo, message: result.message });
      return 'refused';
    }
    await sendEventNotice(row.contract_id, result.event.id, now);
    await ensureContractPaymentLink(row.contract_id, now);
    return 'recorded';
  } catch (error: unknown) {
    console.error('[contracts/production/payment-link] 계약 입금 기록 실패 — 관리자에서 "입금 확인"을 직접 기록해 주세요', { orderNo, error });
    return 'failed';
  }
};

/** 이 주문이 계약 결제 링크의 주문인가 — 결제 링크의 일반 입금 확인 메일을 건너뛸지 정한다. 조회 실패면 false(일반 메일로). */
export const isContractPaymentOrder = async (orderNo: string): Promise<boolean> => {
  try {
    const rows = await getDb().all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM payment_link_orders plo
      JOIN production_contract_payment_links m ON m.slug = plo.slug
      WHERE plo.order_no = ${orderNo}
    `);
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
};

/** 관리자 화면용 — 계약에 걸린 결제 링크 전부(열림·닫힘). */
export const listContractPaymentLinks = async (contractId: string) => {
  try {
    return await getDb().all<{ slug: string; purpose: ContractPaymentLinkPurpose; amount: number; closed_at: number | null; created_at: number; paid_orders: number }>(sql`
      SELECT m.slug, m.purpose, m.amount, l.closed_at, m.created_at,
             (SELECT COUNT(*) FROM payment_link_orders plo JOIN orders o ON o.order_no = plo.order_no
               WHERE plo.slug = m.slug AND o.status IN ('paid', 'partially_refunded', 'refunded')) AS paid_orders
      FROM production_contract_payment_links m JOIN payment_links l ON l.slug = m.slug
      WHERE m.contract_id = ${contractId} ORDER BY m.created_at DESC
    `);
  } catch {
    return [];
  }
};

