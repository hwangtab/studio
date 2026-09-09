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
