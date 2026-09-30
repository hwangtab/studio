import type { TossPayment, TossResult } from '../../lib/booking/toss';

interface Fault {
  code: string;
  message?: string;
}

export interface FakeToss {
  confirmPayment(args: { paymentKey: string; orderId: string; amount: number }): Promise<TossResult>;
  cancelPayment(input: {
    paymentKey: string;
    cancelReason: string;
    cancelAmount: number;
    idempotencyKey?: string;
    paymentMethod?: string | null;
  }): Promise<TossResult>;
  fetchPayment(paymentKey: string): Promise<TossResult>;
  injectFault(key: string, fault: Fault): void;
  setInterceptHook(fn: () => Promise<void> | void): void;
  _payments: Map<string, TossPayment>;
}

/**
 * 결정적 토스 테스트 더블. 실제 네트워크를 타지 않고, 멱등키 재생·장애 주입·
 * "끼어들기 훅"(응답 직전 개입)으로 동시성 시나리오를 재현 가능하게 한다.
 * 판정 기준은 항상 "실제로 빠져나간 금액"(paymentKey당 확정 상태) — 스펙 §14.
 */
export function createFakeToss(): FakeToss {
  const payments = new Map<string, TossPayment>();
  const confirmReplays = new Map<string, TossResult>();
  // 실제 토스는 같은 Idempotency-Key로 다시 오면 최초 응답을 그대로 재생한다(cancels[]를
  // 다시 늘리지 않는다) — 여기서도 같은 replay를 흉내 낸다. 이게 없으면 같은 키로 두 번
  // cancelPayment를 부르는 버그(예: finding #2의 충돌하는 멱등키)가 fake 위에서는 "매번
  // 성공해서 cancels[]가 계속 늘어나는" 것으로만 보여, 실제로는 토스가 두 번째 호출을
  // 재생해 딱 한 번만 돈이 나간다는 사실을 테스트가 검증할 수 없었다.
  const cancelReplays = new Map<string, TossResult>();
  const faults = new Map<string, Fault>();
  let interceptHook: (() => Promise<void> | void) | null = null;

  async function runIntercept() {
    if (interceptHook) await interceptHook();
  }

  function buildPayment(paymentKey: string, orderId: string, amount: number): TossPayment {
    return {
      paymentKey,
      orderId,
      status: 'DONE',
      totalAmount: amount,
      approvedAt: new Date().toISOString(),
      cancels: [],
    };
  }

  return {
    _payments: payments,
    injectFault(key, fault) {
      faults.set(key, fault);
    },
    setInterceptHook(fn) {
      interceptHook = fn;
    },
    async confirmPayment({ paymentKey, orderId, amount }) {
      const replayKey = `confirm:${paymentKey}`;
      if (confirmReplays.has(replayKey)) {
        await runIntercept();
        return confirmReplays.get(replayKey)!;
      }
      const fault = faults.get(replayKey);
      await runIntercept();
      if (fault) {
        const result: TossResult = { ok: false, code: fault.code, message: fault.message ?? fault.code };
        confirmReplays.set(replayKey, result);
        return result;
      }
      const payment = buildPayment(paymentKey, orderId, amount);
      payments.set(paymentKey, payment);
      const result: TossResult = { ok: true, payment };
      confirmReplays.set(replayKey, result);
      return result;
    },
    async cancelPayment({ paymentKey, cancelAmount, cancelReason, idempotencyKey }) {
      // 실제 cancelPayment는 orderId를 받지 않는다 — 장애 주입 키는 호출자가 넘긴
      // idempotencyKey(없으면 paymentKey)로 건다. 두 실제 호출부(lineRefund.ts,
      // shows/confirm.ts의 autoCancelShowApproval) 모두 idempotencyKey를 채워 보낸다.
      const replayKey = `cancel-result:${idempotencyKey ?? paymentKey}`;
      if (cancelReplays.has(replayKey)) {
        // 같은 Idempotency-Key로 다시 왔다 — 실제 토스처럼 최초 응답을 그대로 재생한다.
        // cancels[]를 다시 늘리지 않는다(진짜로 두 번째 취소가 나간 것처럼 보이면 안 된다).
        await runIntercept();
        return cancelReplays.get(replayKey)!;
      }
      const key = `cancel:${idempotencyKey ?? paymentKey}`;
      const fault = faults.get(key);
      await runIntercept();
      if (fault) {
        const result: TossResult = { ok: false, code: fault.code, message: fault.message ?? fault.code };
        cancelReplays.set(replayKey, result);
        return result;
      }
      const existing = payments.get(paymentKey);
      if (!existing) {
        const result: TossResult = { ok: false, code: 'NOT_FOUND_PAYMENT', message: 'payment not found' };
        cancelReplays.set(replayKey, result);
        return result;
      }
      const cancels = [
        ...(existing.cancels ?? []),
        { transactionKey: `tx-${Date.now()}-${Math.random()}`, cancelAmount, cancelReason },
      ];
      const updated: TossPayment = { ...existing, cancels };
      payments.set(paymentKey, updated);
      const result: TossResult = { ok: true, payment: updated };
      cancelReplays.set(replayKey, result);
      return result;
    },
    async fetchPayment(paymentKey) {
      // 실제 토스 fetchPayment는 paymentKey로만 조회한다(orderId 조회 API는 없다) —
      // 예전엔 이 fake가 orderId로도 찾아 줘서(paymentKeyOrOrderId), 프로덕션에서는
      // 절대 통하지 않을 `toss.fetchPayment(orderNo)` 호출이 테스트에서만 성공하는
      // 착시가 있었다(finding #3). paymentKey 하나만 본다.
      await runIntercept();
      const byKey = payments.get(paymentKey);
      if (byKey) return { ok: true, payment: byKey };
      return { ok: false, code: 'NOT_FOUND_PAYMENT', message: 'not found' };
    },
  };
}
