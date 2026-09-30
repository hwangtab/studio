import type { TossPayment, TossResult } from '../../lib/booking/toss';

interface Fault {
  code: string;
  message?: string;
}

export interface FakeToss {
  confirmPayment(args: { paymentKey: string; orderId: string; amount: number }): Promise<TossResult>;
  cancelPayment(paymentKey: string, cancelAmount: number, cancelReason: string, orderId?: string): Promise<TossResult>;
  fetchPayment(paymentKeyOrOrderId: string): Promise<TossResult>;
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
    async cancelPayment(paymentKey, cancelAmount, cancelReason, orderId) {
      const key = `cancel:${orderId ?? paymentKey}`;
      const fault = faults.get(key);
      await runIntercept();
      if (fault) {
        return { ok: false, code: fault.code, message: fault.message ?? fault.code };
      }
      const existing = payments.get(paymentKey);
      if (!existing) {
        return { ok: false, code: 'NOT_FOUND_PAYMENT', message: 'payment not found' };
      }
      const cancels = [
        ...(existing.cancels ?? []),
        { transactionKey: `tx-${Date.now()}-${Math.random()}`, cancelAmount, cancelReason },
      ];
      const updated: TossPayment = { ...existing, cancels };
      payments.set(paymentKey, updated);
      return { ok: true, payment: updated };
    },
    async fetchPayment(paymentKeyOrOrderId) {
      await runIntercept();
      const byKey = payments.get(paymentKeyOrOrderId);
      if (byKey) return { ok: true, payment: byKey };
      const byOrder = [...payments.values()].find((p) => p.orderId === paymentKeyOrOrderId);
      if (byOrder) return { ok: true, payment: byOrder };
      return { ok: false, code: 'NOT_FOUND_PAYMENT', message: 'not found' };
    },
  };
}
