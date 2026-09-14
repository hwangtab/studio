import { readFileSync } from 'node:fs';
import path from 'node:path';

import { REFUND_PENDING_ORDER_STATUSES } from './policy';
import { LIVE_FUNDING_ORDER_STATUSES, isLiveFundingOrderStatus, remainingRefundable } from './refundable';
import type { FundingOrder } from './service';

const order = (totalAmount: number, refunds: Array<{ amount: number; status: string }>): FundingOrder =>
  ({
    totalAmount,
    payments: [{ refunds: refunds.map((r) => ({ ...r })) }],
  } as unknown as FundingOrder);

describe('remainingRefundable', () => {
  it('done 환불만 뺀다', () => {
    expect(remainingRefundable(order(10000, [{ amount: 3000, status: 'done' }, { amount: 5000, status: 'failed' }]))).toBe(7000);
  });
  it('음수로 내려가지 않는다', () => {
    expect(remainingRefundable(order(10000, [{ amount: 12000, status: 'done' }]))).toBe(0);
  });
});

describe('살아 있는 후원 판정', () => {
  it('paid·partially_refunded만 참', () => {
    expect(isLiveFundingOrderStatus('paid')).toBe(true);
    expect(isLiveFundingOrderStatus('partially_refunded')).toBe(true);
    for (const s of ['pending', 'refunded', 'failed', 'expired']) {
      expect(isLiveFundingOrderStatus(s)).toBe(false);
    }
  });

  /**
   * 근거가 다른 두 집합이지만 같은 "살아 있는 후원"을 가리켜야 한다. 갈리면 화면·API·헬스체크가
   * 서로 다른 사실을 말한다 — 발송 기록이 'paid' 하나로 굳어 부분환불 건을 영구 미발송으로
   * 남기던 버그가 정확히 그 형태였다.
   */
  it('policy.ts의 REFUND_PENDING_ORDER_STATUSES와 같은 집합이다', () => {
    expect([...LIVE_FUNDING_ORDER_STATUSES].sort()).toEqual([...REFUND_PENDING_ORDER_STATUSES].sort());
  });
});

/**
 * 판정이 다시 흩어지는 것을 소스 수준에서 막는다. 상태 문자열을 쿼리마다 다시 적는 순간
 * 한 곳만 고치는 사고가 되살아난다 — 이 저장소가 실제로 겪은 형태다.
 */
it('상태 리터럴이 정본 밖에 흩어져 있지 않다', () => {
  const files = [
    'lib/funding/service.ts',
    'lib/funding/admin-list.ts',
    'pages/api/admin/funding/pledges/[id].ts',
    'pages/admin/funding/[id].tsx',
  ];
  for (const f of files) {
    const src = readFileSync(path.join(process.cwd(), f), 'utf-8');
    expect({ file: f, hits: src.match(/'paid',\s*'partially_refunded'/g) ?? [] }).toEqual({ file: f, hits: [] });
  }
});
