/** @jest-environment node */
import { serializePledgeForAdmin } from './admin-serialize';
import type { FundingOrder } from './service';

const NOW = new Date('2026-10-15T03:00:00Z');

const orderWith = (status: string, hasPayment: boolean): FundingOrder =>
  ({
    id: 'o1', orderNo: 'FND-1', status, totalAmount: 5000, customerName: '김후원',
    customerPhone: '010-1111-2222', customerEmail: 'a@example.com', notificationError: null, createdAt: NOW,
    fundingPledge: {
      id: 'p1', projectSlug: 'demo', paymentMethod: 'toss', entrySource: 'online', rewardTitle: 'CD',
      quantity: 1, additionalAmount: 0, fulfillmentStatus: 'none', trackingCompany: null, trackingNumber: null,
      shippingAddress1: null, supporterMessage: null, refundRequestedAt: null, paidAt: null,
      holdExpiresAt: NOW, adminMemo: null,
    },
    payments: hasPayment ? [{ id: 'pay1' }] : [],
  }) as unknown as FundingOrder;

describe('serializePledgeForAdmin — mismatch', () => {
  // pending만 보던 시절엔 승인 경합으로 expired·failed에 남은 "돈은 받았는데 확정 안 된" 건이
  // 관리자 화면에서 정상으로 보였다. 그게 정확히 찾아내야 할 사고 형태다.
  it.each(['pending', 'expired', 'failed'])('결제 기록이 있는데 %s면 미정합', (status) => {
    expect(serializePledgeForAdmin(orderWith(status, true), new Set()).mismatch).toBe(true);
  });
  it.each(['paid', 'partially_refunded', 'refunded'])('%s는 결제 기록이 있어도 정상', (status) => {
    expect(serializePledgeForAdmin(orderWith(status, true), new Set()).mismatch).toBe(false);
  });
  it('결제 기록이 없으면 어떤 상태든 미정합이 아니다', () => {
    expect(serializePledgeForAdmin(orderWith('expired', false), new Set()).mismatch).toBe(false);
  });
});
