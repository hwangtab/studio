import { and, eq, gte, inArray, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { productionContractEvents, refundAccounts } from '../../db/schema';
import { splitInclusiveAmount } from '../booking/amounts';
import { activeEvents, computeProductionLedger, parseEventData } from '../contracts/production/ledger';
import { isMixMasterKind, parseStoredTerms } from '../contracts/production/terms';
import { parseTerminationCause } from '../contracts/production/termination';
import type { RevenueRow } from './revenueReport';

/**
 * 제작·믹싱 계약(production_contracts)으로 받은 돈을 매출 행으로.
 *
 * 계약 대금은 결제 행(`payments`)을 남기지 않는다 — 운영자가 관리자 계약 상세에서 "입금 확인"을 진행 기록
 * (`production_contract_events.type = 'payment_received'`)으로 남길 뿐이다. 그래서 결제 장부만 읽는 매출 현황에서
 * 통째로 빠져 있었다(운영 점검 2026-10-20). 입금 기록 하나가 매출 한 행이다 — 계약금·잔금을 따로 받으면 두 행.
 *
 * - 기준 시각은 입금 기록의 시각(occurredAt). 무효 처리한 기록은 뺀다(activeEvents).
 * - 금액은 부가세 포함으로 받는다(계약금액이 부가세 포함이다) — 부가세는 그 금액에서 역산한다.
 * - 환불: 해지한 계약에서 환불 송금을 마쳤으면(`refund_accounts.refunded_at`) 정산 계산(ledger)의 환불액을 늦은 입금
 *   행부터 차감한다. 송금 전이면 아직 돌려준 돈이 아니라 빼지 않는다.
 * - 유형: 믹싱·마스터링 계약은 '믹싱·마스터링', 나머지(싱글·EP·정규 제작)는 '음원 제작'. 둘 다 스튜디오 직접 서비스.
 *
 * 개인정보(이름·연락처)는 싣지 않는다 — 매출 현황과 같은 원칙(revenueReport.ts).
 */
export const loadProductionRevenueRows = async (range: { from: Date; toExclusive: Date }, now: Date = new Date()): Promise<RevenueRow[]> => {
  const db = getDb();
  const paymentEvents = await db.query.productionContractEvents.findMany({
    where: and(
      eq(productionContractEvents.type, 'payment_received'),
      gte(productionContractEvents.occurredAt, range.from),
      lt(productionContractEvents.occurredAt, range.toExclusive),
    ),
    columns: { contractId: true },
  });
  const contractIds = [...new Set(paymentEvents.map((e) => e.contractId))];
  if (contractIds.length === 0) return [];

  const contracts = await db.query.productionContracts.findMany({
    where: (c, { inArray: within }) => within(c.id, contractIds),
    with: { events: true },
  });
  const refundedOrders = new Set(
    (
      await db
        .select({ orderNo: refundAccounts.orderNo, refundedAt: refundAccounts.refundedAt })
        .from(refundAccounts)
        .where(and(eq(refundAccounts.orderKind, 'production'), inArray(refundAccounts.orderNo, contractIds)))
    )
      .filter((row) => row.refundedAt !== null)
      .map((row) => row.orderNo),
  );

  const rows: RevenueRow[] = [];
  for (const contract of contracts) {
    const terms = parseStoredTerms(contract.termsJson);
    // 결제 링크로 받은 입금(data.orderNo)은 결제 행(payments)으로 이미 매출에 잡힌다 — 여기서는 빼서 두 번 세지 않는다.
    // 환불 차감도 직접 기록한 입금에만 건다(링크 결제의 환불은 결제 행의 refunds로 잡힌다).
    const payments = activeEvents(contract.events)
      .filter((e) => e.type === 'payment_received' && (e.amount ?? 0) > 0 && !parseEventData(e).orderNo)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    let refundLeft = 0;
    if (contract.status === 'terminated' && refundedOrders.has(contract.id)) {
      const ledger = computeProductionLedger({
        terms,
        signedAt: contract.signedAt,
        events: contract.events,
        now,
        terminationCause: parseTerminationCause(contract.terminationReason),
      });
      refundLeft = Math.max(0, ledger.refund.refundable);
    }

    // 환불은 늦은 입금부터 차감한다(먼저 받은 계약금이 작업분에 먼저 들어간다고 본다).
    const refunds = new Map<string, number>();
    for (const event of [...payments].reverse()) {
      if (refundLeft <= 0) break;
      const take = Math.min(refundLeft, event.amount ?? 0);
      refunds.set(event.id, take);
      refundLeft -= take;
    }

    for (const event of payments) {
      if (event.occurredAt < range.from || event.occurredAt >= range.toExclusive) continue;
      const gross = event.amount ?? 0;
      rows.push({
        at: event.occurredAt,
        orderNo: `PC-${contract.id.slice(0, 8).toUpperCase()}`,
        type: isMixMasterKind(contract.kind) ? 'mixing' : 'production',
        projectSlug: null,
        method: '계좌 입금',
        gross,
        vat: splitInclusiveAmount(gross).vatAmount,
        refunded: refunds.get(event.id) ?? 0,
        offline: true,
        note: contract.title,
      });
    }
  }
  return rows;
};
