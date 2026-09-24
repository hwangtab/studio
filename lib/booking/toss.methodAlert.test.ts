/**
 * 승인 응답을 받는 자리에 결제수단 점검이 실제로 걸려 있는가 — 그리고 그 점검이 결제를
 * 깨뜨리지 않는가.
 *
 * DB(레이트리밋)와 메일만 가리고 점검 로직은 실제 코드를 쓴다. 가려 버리면 "결제가
 * 정상 처리된다"는 이 파일의 요지가 검증되지 않는다.
 * @jest-environment node
 */
jest.mock('./rate-limit', () => ({ consumeRateLimit: jest.fn() }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn() }));

import { sendEmail } from '../email/resend';
import { resetPaymentMethodAlertMemo } from '../payments/methodAlert';
import { consumeRateLimit } from './rate-limit';
import { confirmPayment, fetchPayment } from './toss';

const mockLimit = consumeRateLimit as jest.Mock;
const mockSend = sendEmail as jest.Mock;

const respond = (payment: Record<string, unknown>) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payment }) as unknown as typeof fetch;
};

describe('승인 응답의 결제수단 점검', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    resetPaymentMethodAlertMemo();
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    mockLimit.mockResolvedValue(true);
    mockSend.mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = realFetch;
    (console.error as jest.Mock).mockRestore();
  });

  it('아는 수단이면 조용하다', async () => {
    respond({ paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 1000, method: '카드' });
    const r = await confirmPayment({ paymentKey: 'pk', orderId: 'SNB-1', amount: 1000 });
    expect(r).toMatchObject({ ok: true });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('모르는 수단이면 알리고, 결제는 그대로 성공으로 돌려준다', async () => {
    respond({ paymentKey: 'pk', orderId: 'SNB-2', status: 'DONE', totalAmount: 1000, method: '토스페이먼츠新수단' });
    const r = await confirmPayment({ paymentKey: 'pk', orderId: 'SNB-2', amount: 1000 });

    expect(r).toMatchObject({ ok: true, payment: { status: 'DONE' } });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].subject).toContain('토스페이먼츠新수단');
  });

  it('알림이 실패해도 결제는 정상 처리된다', async () => {
    mockSend.mockRejectedValue(new Error('resend down'));
    respond({ paymentKey: 'pk', orderId: 'SNB-3', status: 'DONE', totalAmount: 1000, method: '토스페이먼츠新수단' });
    await expect(confirmPayment({ paymentKey: 'pk', orderId: 'SNB-3', amount: 1000 }))
      .resolves.toMatchObject({ ok: true });
  });

  it('웹훅 복구 경로(재조회)도 같은 점검을 지난다', async () => {
    respond({ paymentKey: 'pk', orderId: 'SNB-4', status: 'DONE', totalAmount: 1000, method: '토스페이먼츠新수단' });
    const r = await fetchPayment('pk');
    expect(r).toMatchObject({ ok: true });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].text).toContain('결제 재조회(fetchPayment)');
  });
});
