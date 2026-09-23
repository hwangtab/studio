jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

import { sendEmail } from '../email/resend';
import {
  sendBookingCancelledEmails,
  sendBookingConfirmedEmails,
  sendMixingOrderCancelledEmails,
  sendMixingOrderConfirmedEmails,
} from './email';
import type { Booking, Order, WorkOrder } from '../../db/schema';

const order = {
  id: 'o1', orderNo: 'SNB-1', status: 'paid', totalAmount: 220000,
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'singer@studio.test',
  manageToken: 'tok',
} as unknown as Order;

const booking = {
  id: 'b1', status: 'confirmed', startAt: new Date('2026-09-10T05:00:00Z'), endAt: new Date('2026-09-10T08:00:00Z'),
  durationHours: 3, serviceType: 'recording', customerNote: null,
} as unknown as Booking;

const workOrder = {
  id: 'w1', status: 'received', productId: 'mixing-level1', serviceType: 'mixing', songCount: 1,
  vocalTuning: false, customerNote: null,
} as unknown as WorkOrder;

/** 고객에게 나간 메일 = 첫 번째 sendEmail 호출(두 번째는 운영자 메일). */
const customerCall = (): Record<string, unknown> =>
  (sendEmail as jest.Mock).mock.calls[0][0] as Record<string, unknown>;

afterEach(() => jest.clearAllMocks());

// 발신은 noreply@ 라서 replyTo가 없으면 고객의 답장이 사라진다. 믹싱 확정 메일은 본문이
// "이 메일에 회신으로 파일 링크를 보내주세요"라고 회신을 **요구**하므로 특히 치명적이다.
describe('고객 메일의 replyTo', () => {
  it('믹싱 확정 메일은 hello@ 별칭으로 회신되게 한다 (본문이 회신을 요구한다)', async () => {
    await sendMixingOrderConfirmedEmails(order, workOrder);
    const call = customerCall();
    expect(call.to).toBe('singer@studio.test');
    expect(call.replyTo).toBe('hello@studionol.co.kr');
    expect(String(call.text)).toContain('이 메일에 회신으로');
  });

  it('세션 확정·취소, 믹싱 취소 메일도 같은 회신 주소를 붙인다', async () => {
    await sendBookingConfirmedEmails(order, booking);
    expect(customerCall().replyTo).toBe('hello@studionol.co.kr');
    jest.clearAllMocks();

    await sendBookingCancelledEmails(order, booking, 220000);
    expect(customerCall().replyTo).toBe('hello@studionol.co.kr');
    jest.clearAllMocks();

    await sendMixingOrderCancelledEmails(order, workOrder, 220000);
    expect(customerCall().replyTo).toBe('hello@studionol.co.kr');
  });
});

/**
 * 보관 기간이 지난 주문은 이메일 칸이 파기 표식으로 덮인다. 발송을 막는 것만으로는
 * 부족하다 — 실패로 세면 그 문자열이 orders.notificationError에 남고, 헬스체크의
 * '확인 메일이 나가지 않은 주문' 경보가 매일 영원히 울린다. 나이 게이트가 없는 관리자
 * 알림 재발송이 그 경로다.
 */
describe('파기된 주문의 고객 메일', () => {
  const purged = { ...order, customerEmail: '(개인정보 파기됨)' } as unknown as Order;

  it.each([
    ['세션 확정', () => sendBookingConfirmedEmails(purged, booking)],
    ['세션 취소', () => sendBookingCancelledEmails(purged, booking, 220000)],
    ['믹싱 확정', () => sendMixingOrderConfirmedEmails(purged, workOrder)],
    ['믹싱 취소', () => sendMixingOrderCancelledEmails(purged, workOrder, 220000)],
  ])('%s — 고객에게 보내지 않고 실패로도 세지 않는다', async (_label, run) => {
    expect(await run()).toBeNull();
    // 운영자 사본 한 통만 나간다 — 파기된 주문이라도 무슨 일이 있었는지는 알아야 한다.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(customerCall().to).not.toBe('(개인정보 파기됨)');
  });

  // 표식만 가른다. 잘못된 주소가 들어온 것은 보낼 곳이 사라진 것과 다른 사건이라 센다.
  it('RFC 2606 시험용 주소의 실패는 여전히 센다', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'UNDELIVERABLE_ADDRESS' });
    expect(await sendBookingConfirmedEmails(order, booking)).toBe('customer:UNDELIVERABLE_ADDRESS');
  });
});
