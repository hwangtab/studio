/** @jest-environment node */
import { serializePledgeForAdmin } from './admin-serialize';
import type { FundingOrder } from './service';

const NOW = new Date('2026-10-15T03:00:00Z');

const orderWith = (status: string, hasPayment: boolean, refundRequestedAt: Date | null = null): FundingOrder =>
  ({
    id: 'o1', orderNo: 'FND-1', status, totalAmount: 5000, customerName: '김후원',
    customerPhone: '010-1111-2222', customerEmail: 'a@example.com', notificationError: null, createdAt: NOW,
    fundingPledge: {
      id: 'p1', projectSlug: 'demo', paymentMethod: 'toss', entrySource: 'online', rewardTitle: 'CD',
      quantity: 1, additionalAmount: 0, fulfillmentStatus: 'none', trackingCompany: null, trackingNumber: null,
      shippingAddress1: null, supporterMessage: null, refundRequestedAt, paidAt: null,
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

/**
 * 무통장 청약철회는 orders.status를 paid로 남긴 채 refundRequestedAt만 찍는다 — 목록의
 * 상태 칸만 보면 정상 확정 건과 구분이 안 되고, 그대로 발송 CSV에 실린다.
 */
describe('serializePledgeForAdmin — refundRequested', () => {
  it('환불 요청 시각이 있으면 status가 paid여도 refundRequested', () => {
    const item = serializePledgeForAdmin(orderWith('paid', true, new Date('2026-10-16T02:00:00Z')), new Set());
    expect(item.refundRequested).toBe(true);
    expect(item.status).toBe('paid');
    expect(item.refundRequestedAt).toBe('2026-10-16T02:00:00.000Z');
  });
  it('요청이 없으면 false', () => {
    expect(serializePledgeForAdmin(orderWith('paid', true), new Set()).refundRequested).toBe(false);
  });
  // cancel.ts는 환불할 때 refundRequestedAt을 지우지 않는다 — 시각만 보면 첫 환불을 처리한
  // 다음 날부터 배너·배지가 영구히 켜진 채로 남아 이 신호가 첫 사용 직후 죽는다.
  it('환불이 끝난 건은 요청 시각이 남아 있어도 false', () => {
    const item = serializePledgeForAdmin(orderWith('refunded', true, new Date('2026-10-16T02:00:00Z')), new Set());
    expect(item.refundRequested).toBe(false);
    // 상세 화면이 쓰는 원본 시각은 그대로 보존한다.
    expect(item.refundRequestedAt).toBe('2026-10-16T02:00:00.000Z');
  });
  // 잔액이 남은 부분환불 건은 아직 환불이 덜 끝난 것이라 신호가 꺼지면 안 된다.
  it('partially_refunded는 여전히 true', () => {
    expect(serializePledgeForAdmin(orderWith('partially_refunded', true, new Date()), new Set()).refundRequested).toBe(true);
  });
});
