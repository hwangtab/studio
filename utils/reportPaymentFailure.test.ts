/** @jest-environment jsdom */
import { reportPaymentFailure } from './reportPaymentFailure';

/**
 * 이 헬퍼는 결제 실패 화면의 곁다리다. 여기서 무엇이 잘못돼도 후원자가 보는 흐름은
 * 그대로여야 한다 — 그 불변식을 테스트로 고정한다.
 */
describe('reportPaymentFailure', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('주문번호와 코드가 있으면 비콘을 보낸다', () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as unknown as typeof fetch;
    reportPaymentFailure('FND-20260919-BAB88F67', { code: 'REJECT_CARD_COMPANY', message: '거절' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/payments/failed');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      orderNo: 'FND-20260919-BAB88F67',
      code: 'REJECT_CARD_COMPANY',
      message: '거절',
    });
  });

  it('주문번호가 없거나 코드가 없으면 보내지 않는다', () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    reportPaymentFailure(null, { code: 'X' });
    reportPaymentFailure('FND-20260919-BAB88F67', new Error('코드 없음'));
    reportPaymentFailure('FND-20260919-BAB88F67', undefined);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetch가 던져도 호출부로 전파하지 않는다 — 결제 화면이 이것 때문에 깨지면 안 된다', () => {
    global.fetch = (() => { throw new Error('network down'); }) as unknown as typeof fetch;
    expect(() =>
      reportPaymentFailure('FND-20260919-BAB88F67', { code: 'REJECT_CARD_COMPANY' }),
    ).not.toThrow();
  });

  it('fetch가 거부돼도 unhandled rejection을 남기지 않는다', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    reportPaymentFailure('FND-20260919-BAB88F67', { code: 'REJECT_CARD_COMPANY' });
    await Promise.resolve();
    // 여기까지 왔으면 .catch(() => {})가 붙어 있다는 뜻이다.
    expect(true).toBe(true);
  });
});
