/**
 * jsdom(기본 testEnvironment)의 AbortSignal에는 .timeout()이 없다(jsdom 20.0.3 확인,
 * .abort()만 존재). toss.ts는 AbortSignal.timeout을 쓰므로 이 파일만 node 환경으로 돈다.
 * @jest-environment node
 */
import { confirmPayment, cancelPayment, fetchPayment } from './toss';

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

describe('cancelPayment', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('paymentKey를 URL 인코딩하고 POST로 취소 사유·금액을 보낸다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    const cancelledPayment = { paymentKey: 'pay/key+1', orderId: 'SNB-2', status: 'CANCELED', totalAmount: 275000 };
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => cancelledPayment });
    global.fetch = mock as unknown as typeof fetch;
    const result = await cancelPayment({ paymentKey: 'pay/key+1', cancelReason: '고객 요청', cancelAmount: 275000 });
    expect(result).toEqual({ ok: true, payment: cancelledPayment });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe(`https://api.tosspayments.com/v1/payments/${encodeURIComponent('pay/key+1')}/cancel`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ cancelReason: '고객 요청', cancelAmount: 275000 });
  });
});

describe('fetchPayment', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('GET으로 조회하고 성공 응답을 돌려준다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => okPayment });
    global.fetch = mock as unknown as typeof fetch;
    const result = await fetchPayment('pk');
    expect(result).toEqual({ ok: true, payment: okPayment });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe('https://api.tosspayments.com/v1/payments/pk');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });
});

describe('CONFIG_ERROR', () => {
  const realFetch = global.fetch;
  const realSecret = process.env.TOSS_SECRET_KEY;
  afterEach(() => {
    global.fetch = realFetch;
    if (realSecret === undefined) delete process.env.TOSS_SECRET_KEY;
    else process.env.TOSS_SECRET_KEY = realSecret;
  });

  it('TOSS_SECRET_KEY가 없으면 fetch를 호출하지 않고 CONFIG_ERROR를 돌려준다', async () => {
    delete process.env.TOSS_SECRET_KEY;
    const mock = jest.fn();
    global.fetch = mock as unknown as typeof fetch;
    const result = await confirmPayment({ paymentKey: 'pk', orderId: 'SNB-1', amount: 275000 });
    expect(result).toEqual({ ok: false, code: 'CONFIG_ERROR', message: 'TOSS_SECRET_KEY가 설정되지 않았습니다.' });
    expect(mock).not.toHaveBeenCalled();
  });
});
