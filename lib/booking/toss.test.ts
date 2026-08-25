/**
 * jsdom(기본 testEnvironment)의 AbortSignal에는 .timeout()이 없다(jsdom 20.0.3 확인,
 * .abort()만 존재). toss.ts는 AbortSignal.timeout을 쓰므로 이 파일만 node 환경으로 돈다.
 * @jest-environment node
 */
import { confirmPayment } from './toss';

const okPayment = { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 275000 };

describe('confirmPayment', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('시크릿 키를 Basic 헤더로 보내고 응답을 돌려준다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => okPayment });
    global.fetch = mock as unknown as typeof fetch;
    const result = await confirmPayment({ paymentKey: 'pk', orderId: 'SNB-1', amount: 275000 });
    expect(result).toEqual({ ok: true, payment: okPayment });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe('https://api.tosspayments.com/v1/payments/confirm');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('test_sk_abc:').toString('base64')}`);
  });

  it('토스 에러 응답은 코드·메시지로 돌려준다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, json: async () => ({ code: 'NOT_FOUND_PAYMENT', message: '없는 결제' }),
    }) as unknown as typeof fetch;
    const result = await confirmPayment({ paymentKey: 'x', orderId: 'y', amount: 1 });
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND_PAYMENT', message: '없는 결제' });
  });
});
