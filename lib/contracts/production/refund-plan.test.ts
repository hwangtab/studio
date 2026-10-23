import type { ProductionContractEvent } from '../../../db/schema';
import { allocateContractRefund, groupRefundPlan } from './refund-plan';

const kst = (local: string) => new Date(`${local}+09:00`);
let seq = 0;
const pay = (at: string, amount: number, orderNo?: string): ProductionContractEvent => {
  seq += 1;
  return {
    id: `e${seq}`,
    contractId: 'c1',
    seq,
    type: 'payment_received',
    stage: null,
    song: null,
    amount,
    dataJson: orderNo ? JSON.stringify({ orderNo }) : null,
    occurredAt: kst(at),
    recordedAt: kst(at),
    actor: 'system:payment',
    actorIp: null,
    voidsEventId: null,
    noticeStatus: 'sent',
    noticeSentAt: kst(at),
    noticeError: null,
    createdAt: kst(at),
  };
};

describe('해지 환불 배분 — 늦은 입금부터', () => {
  const deposit = pay('2026-11-03T09:00:00', 500_000, 'ORD-DEP');
  const second = pay('2026-11-20T09:00:00', 300_000, 'ORD-SEC');
  const direct = pay('2026-11-25T09:00:00', 100_000);

  it('환불액을 마지막 입금부터 채운다', () => {
    expect(allocateContractRefund([deposit, second, direct], 560_000)).toEqual([
      { eventId: direct.id, orderNo: null, amount: 100_000 },
      { eventId: second.id, orderNo: 'ORD-SEC', amount: 300_000 },
      { eventId: deposit.id, orderNo: 'ORD-DEP', amount: 160_000 },
    ]);
  });

  it('받은 금액을 넘겨 나누지 않고, 0원이면 비어 있다', () => {
    expect(allocateContractRefund([deposit], 900_000)).toEqual([{ eventId: deposit.id, orderNo: 'ORD-DEP', amount: 500_000 }]);
    expect(allocateContractRefund([deposit], 0)).toEqual([]);
  });

  it('무효 처리한 입금은 세지 않는다', () => {
    const voided = { ...pay('2026-11-26T09:00:00', 0), type: 'void' as const, voidsEventId: direct.id };
    expect(allocateContractRefund([deposit, direct, voided], 100_000)).toEqual([{ eventId: deposit.id, orderNo: 'ORD-DEP', amount: 100_000 }]);
  });

  it('결제 수단별로 묶는다 — 카드는 토스 취소, 계좌 입금 링크·직접 기록은 계좌 송금', () => {
    const allocations = allocateContractRefund([deposit, second, direct], 560_000);
    const plan = groupRefundPlan(allocations, 560_000, (orderNo) =>
      orderNo === 'ORD-DEP' ? { bankDeposit: false, refunded: 0 } : orderNo === 'ORD-SEC' ? { bankDeposit: true, refunded: 0 } : null,
    );
    expect(plan.card).toEqual([{ orderNo: 'ORD-DEP', amount: 160_000, refunded: 0 }]);
    expect(plan.bankLink).toEqual([{ orderNo: 'ORD-SEC', amount: 300_000 }]);
    expect(plan.direct).toBe(100_000);
    expect(plan.bankTotal).toBe(400_000);
    expect(plan.cardPending).toBe(160_000);
  });

  it('이미 취소한 카드 몫은 남은 금액에서 뺀다(재시도), 주문을 못 찾으면 계좌 송금으로', () => {
    const allocations = allocateContractRefund([deposit, second], 800_000);
    const plan = groupRefundPlan(allocations, 800_000, (orderNo) => (orderNo === 'ORD-DEP' ? { bankDeposit: false, refunded: 500_000 } : null));
    expect(plan.cardPending).toBe(0);
    expect(plan.bankLink).toEqual([{ orderNo: 'ORD-SEC', amount: 300_000 }]);
  });
});
