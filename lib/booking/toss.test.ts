/**
 * jsdom(기본 testEnvironment)의 AbortSignal에는 .timeout()이 없다(jsdom 20.0.3 확인,
 * .abort()만 존재). toss.ts는 AbortSignal.timeout을 쓰므로 이 파일만 node 환경으로 돈다.
 * @jest-environment node
 */
import { VIRTUAL_ACCOUNT_CANCEL_CUSTOMER_MESSAGE, confirmPayment, cancelPayment, fetchPayment } from './toss';

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

  // 회귀: 이 헤더가 빠지면 취소 타임아웃(NETWORK_ERROR) 뒤의 재시도가 토스에서 별개의
  // 취소로 처리돼 부분환불 티어에서 정책 초과 환불이 나간다(cancel.ts refundIdempotencyKey).
  it('idempotencyKey를 주면 Idempotency-Key 헤더로 그대로 보낸다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => okPayment });
    global.fetch = mock as unknown as typeof fetch;
    await cancelPayment({
      paymentKey: 'pk', cancelReason: '고객 요청', cancelAmount: 137500,
      idempotencyKey: 'refund:SNB-1:137500',
    });
    const [, init] = mock.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe('refund:SNB-1:137500');
    expect(String('refund:SNB-1:137500').length).toBeLessThanOrEqual(300); // 토스 규격 상한
  });

  it('idempotencyKey가 없으면 헤더를 붙이지 않는다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => okPayment });
    global.fetch = mock as unknown as typeof fetch;
    await cancelPayment({ paymentKey: 'pk', cancelReason: '고객 요청', cancelAmount: 1 });
    const [, init] = mock.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBeUndefined();
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

/**
 * 가상계좌는 우리가 쓸 수 없는 결제수단이다(2026-09-11 확인) — 환불에
 * refundReceiveAccount(은행·계좌번호·예금주)가 필수인데 그 값을 받는 화면도 저장하는 자리도 없다.
 * 코드에 결제수단 제한이 없어(위젯은 콘솔에서 개통된 수단을 그대로 보여준다) 조용히 흘러들면
 * 그 주문의 취소·환불이 전부 502로 끝나고, 약관 제10조의 3영업일 환불을 이행할 수단이 사라진다.
 */
describe('가상계좌 차단', () => {
  const realFetch = global.fetch;
  beforeEach(() => { process.env.TOSS_SECRET_KEY = 'test_sk_abc'; });
  afterEach(() => { global.fetch = realFetch; });

  const respond = (payment: Record<string, unknown>) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payment }) as unknown as typeof fetch;
  };

  it('미입금 가상계좌 승인은 거절한다 — 주문이 확정되지 않는다', async () => {
    respond({ paymentKey: 'pk', orderId: 'FND-1', status: 'WAITING_FOR_DEPOSIT', totalAmount: 30000, method: '가상계좌' });
    const r = await confirmPayment({ paymentKey: 'pk', orderId: 'FND-1', amount: 30000 });
    expect(r).toMatchObject({ ok: false, code: 'VIRTUAL_ACCOUNT_UNSUPPORTED' });
  });

  it('method가 비어 와도 WAITING_FOR_DEPOSIT이면 거절한다', async () => {
    respond({ paymentKey: 'pk', orderId: 'FND-1', status: 'WAITING_FOR_DEPOSIT', totalAmount: 30000 });
    expect(await confirmPayment({ paymentKey: 'pk', orderId: 'FND-1', amount: 30000 }))
      .toMatchObject({ ok: false, code: 'VIRTUAL_ACCOUNT_UNSUPPORTED' });
  });

  /**
   * 이미 입금된(DONE) 건은 통과시킨다 — 받은 돈을 미기록으로 남기는 쪽이 훨씬 나쁘다.
   * 그 건은 기록한 뒤 관리자 화면의 경고(virtualAccountPayment)로 드러낸다.
   */
  it('입금이 끝난 DONE 건은 통과시킨다', async () => {
    respond({ paymentKey: 'pk', orderId: 'FND-1', status: 'DONE', totalAmount: 30000, method: '가상계좌' });
    expect(await confirmPayment({ paymentKey: 'pk', orderId: 'FND-1', amount: 30000 })).toMatchObject({ ok: true });
  });

  it('카드 결제는 영향을 받지 않는다', async () => {
    respond({ paymentKey: 'pk', orderId: 'FND-1', status: 'DONE', totalAmount: 30000, method: '카드' });
    expect(await confirmPayment({ paymentKey: 'pk', orderId: 'FND-1', amount: 30000 })).toMatchObject({ ok: true });
  });

  /**
   * 토스를 부르면 refundReceiveAccount 누락으로 거절되고 그 원문이 고객 화면에 그대로 노출된다.
   *
   * **기본 문구는 고객용이다** — 이 message는 셀프 취소 응답 본문에 그대로 실린다. 운영 지시
   * ("토스 콘솔에서…")는 관리자 요청일 때만 cancel.ts가 바꿔 단다.
   */
  it('가상계좌 취소는 토스를 부르지 않고 고객용 문구로 끝낸다', async () => {
    const mock = jest.fn();
    global.fetch = mock as unknown as typeof fetch;
    const r = await cancelPayment({ paymentKey: 'pk', cancelReason: 'x', cancelAmount: 1000, paymentMethod: '가상계좌' });
    expect(r).toMatchObject({ ok: false, code: 'VIRTUAL_ACCOUNT_UNSUPPORTED' });
    expect(r.ok === false && r.message).toBe(VIRTUAL_ACCOUNT_CANCEL_CUSTOMER_MESSAGE);
    expect(r.ok === false && r.message).not.toContain('토스 콘솔');
    expect(mock).not.toHaveBeenCalled();
  });

  it('카드 취소는 종전대로 토스를 부른다', async () => {
    respond({ paymentKey: 'pk', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 1000 });
    const r = await cancelPayment({ paymentKey: 'pk', cancelReason: 'x', cancelAmount: 1000, paymentMethod: '카드' });
    expect(r.ok).toBe(true);
  });

  it('결제수단을 모르면 종전대로 토스를 부른다(지연 승인 자동 취소 경로)', async () => {
    respond({ paymentKey: 'pk', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 1000 });
    expect((await cancelPayment({ paymentKey: 'pk', cancelReason: 'x', cancelAmount: 1000 })).ok).toBe(true);
  });
});
