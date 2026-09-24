/** @jest-environment node */

/**
 * 모르는 결제수단 알림 — 드러내되 결제를 막지 않는다.
 *
 * 레이트리밋과 메일 발송은 가린다(DB·네트워크). `consumeRateLimit` 자체의 창 동작은
 * `lib/booking/rate-limit.test.ts`가 실제 SQLite로 검증하므로 여기서는 "키가 무엇이고
 * 몇 번 호출되는가"만 본다.
 */
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn() }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn() }));

import { consumeRateLimit } from '../booking/rate-limit';
import { sendEmail } from '../email/resend';
import { checkPaymentMethod } from './methodAlert';

const mockLimit = consumeRateLimit as jest.Mock;
const mockSend = sendEmail as jest.Mock;

describe('checkPaymentMethod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLimit.mockResolvedValue(true);
    mockSend.mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it.each(['카드', '가상계좌', '간편결제', '계좌이체', '휴대폰', ' 카드 '])(
    '아는 수단(%s)이면 조용하다',
    async (method) => {
      await checkPaymentMethod({ method, context: '테스트' });
      expect(mockLimit).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    },
  );

  it('method가 없으면 알리지 않는다 — 이름을 댈 수 없는 알림은 할 수 있는 일이 없다', async () => {
    await checkPaymentMethod({ method: null, context: '테스트' });
    await checkPaymentMethod({ method: '  ', context: '테스트' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('모르는 수단이면 운영자에게 알리고, method 값을 싣는다', async () => {
    await checkPaymentMethod({
      method: '해외간편결제', context: '예약·후원 승인(confirmPayment)',
      orderId: 'SNB-1', paymentKey: 'pk_1', status: 'DONE',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0];
    expect(mail.subject).toContain('해외간편결제');
    expect(mail.text).toContain('해외간편결제');
    expect(mail.text).toContain('예약·후원 승인(confirmPayment)');
    expect(mail.text).toContain('SNB-1');
  });

  it('레이트리밋 키는 수단별이고 기존 알림 키와 겹치지 않는다', async () => {
    await checkPaymentMethod({ method: '해외간편결제', context: '테스트' });
    await checkPaymentMethod({ method: '알 수 없는 수단', context: '테스트' });

    const keys = mockLimit.mock.calls.map((c) => c[0]);
    expect(keys).toEqual(['payment_method_drift:해외간편결제', 'payment_method_drift:알_수_없는_수단']);
    // 기존 키 접두사(webhook:, booking_create:, contact_, contract_download:)와 겹치지 않는다.
    for (const key of keys) {
      expect(key.startsWith('payment_method_drift:')).toBe(true);
    }
    // 창당 한 통 — 한도 1, 창 24시간.
    for (const call of mockLimit.mock.calls) expect(call.slice(1)).toEqual([1, 24 * 60 * 60]);
  });

  it('창 안에서 두 번째 결제는 메일을 보내지 않는다', async () => {
    mockLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await checkPaymentMethod({ method: '해외간편결제', context: '테스트' });
    await checkPaymentMethod({ method: '해외간편결제', context: '테스트' });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('알림이 실패해도 던지지 않는다 — 이미 승인된 결제를 깨뜨리지 않는다', async () => {
    mockSend.mockRejectedValue(new Error('resend down'));
    await expect(checkPaymentMethod({ method: '해외간편결제', context: '테스트' })).resolves.toBeUndefined();

    mockLimit.mockRejectedValue(new Error('db down'));
    await expect(checkPaymentMethod({ method: '해외간편결제', context: '테스트' })).resolves.toBeUndefined();
  });

  it('응답 본문을 싣지 않는다 — 가상계좌·휴대폰 응답에는 개인정보가 있다', async () => {
    await checkPaymentMethod({
      method: '해외간편결제', context: '테스트', orderId: 'SNB-2', paymentKey: 'pk_2', status: 'DONE',
    });
    const mail = mockSend.mock.calls[0][0];
    // 함수는 개별 필드만 받는다 — 본문을 통째로 넘길 인자가 애초에 없다.
    expect(mail.text).not.toContain('{');
  });
});
