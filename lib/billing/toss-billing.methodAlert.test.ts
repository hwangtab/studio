/**
 * 정기결제 회차에도 결제수단 점검이 걸려 있는가.
 *
 * 이 경로는 cron이 무인으로 돈다(`pages/api/cron/billing-charge.ts`) — 배선이 빠져도
 * 사람이 화면에서 알아챌 기회가 없다. 그래서 예약·후원 쪽(`lib/booking/toss.methodAlert.test.ts`)과
 * 따로 한 벌 더 둔다.
 * @jest-environment node
 */
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn() }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn() }));

import { consumeRateLimit } from '../booking/rate-limit';
import { sendEmail } from '../email/resend';
import { resetPaymentMethodAlertMemo } from '../payments/methodAlert';
import { chargeBillingKey } from './toss-billing';

const mockLimit = consumeRateLimit as jest.Mock;
const mockSend = sendEmail as jest.Mock;

const charge = () =>
  chargeBillingKey({
    billingKey: 'bk', customerKey: 'sub_1', amount: 50000,
    orderId: 'SUB-1', orderName: '레슨 9월', idempotencyKey: 'idem-1',
  });

describe('정기결제 회차의 결제수단 점검', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    resetPaymentMethodAlertMemo();
    process.env.TOSS_BILLING_SECRET_KEY = 'test_sk_billing';
    mockLimit.mockResolvedValue(true);
    mockSend.mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = realFetch;
    (console.error as jest.Mock).mockRestore();
  });

  const respond = (payment: Record<string, unknown>) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payment }) as unknown as typeof fetch;
  };

  it('카드면 조용하다', async () => {
    respond({ paymentKey: 'pk', orderId: 'SUB-1', status: 'DONE', totalAmount: 50000, method: '카드' });
    await expect(charge()).resolves.toMatchObject({ ok: true });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('모르는 수단이면 알리고, 회차 결제는 그대로 성공으로 돌려준다', async () => {
    respond({ paymentKey: 'pk', orderId: 'SUB-1', status: 'DONE', totalAmount: 50000, method: '빌링新수단' });
    await expect(charge()).resolves.toMatchObject({ ok: true, payment: { status: 'DONE' } });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].subject).toContain('빌링新수단');
    expect(mockSend.mock.calls[0][0].text).toContain('정기결제 회차(chargeBillingKey)');
  });

  it('알림이 실패해도 회차 결제는 정상 처리된다', async () => {
    mockSend.mockRejectedValue(new Error('resend down'));
    respond({ paymentKey: 'pk', orderId: 'SUB-1', status: 'DONE', totalAmount: 50000, method: '빌링新수단' });
    await expect(charge()).resolves.toMatchObject({ ok: true });
  });
});
