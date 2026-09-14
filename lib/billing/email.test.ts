jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

import { sendEmail } from '../email/resend';
import { sendSubscriptionOperatorAlert, sendSubscriptionSetupEmail } from './email';
import type { Subscription } from '../../db/schema';

const sub = (overrides: Partial<Subscription> = {}) =>
  ({
    id: 'sub-1',
    kind: 'lesson',
    customerName: '김수강',
    customerPhone: '010-1234-5678',
    customerEmail: 'student@studio.test',
    totalAmount: 396000,
    billingDay: 5,
    setupMode: 'initial',
    ...overrides,
  }) as unknown as Subscription;

const lastCall = (): Record<string, string> => {
  const calls = (sendEmail as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as Record<string, string>;
};

beforeEach(() => jest.clearAllMocks());

/**
 * 링크 하나에 두 모드가 있다('initial'은 등록 즉시 첫 달치 결제, 'change'는 카드만 교체).
 * 한 문구로 뭉뚱그리면 둘 중 하나는 거짓이 된다 — 예전엔 카드 교체 링크를 받은 고객에게도
 * "즉시 첫 달치가 결제되고"라고 알려 **없는 청구를 예고**했다.
 */
describe('sendSubscriptionSetupEmail — setupMode별 안내', () => {
  it("initial은 첫 달치 결제를 명시한다", async () => {
    await sendSubscriptionSetupEmail(sub({ setupMode: 'initial' }), 'https://studionol.co.kr/ko/subscribe/sub-1?token=t');
    const mail = lastCall();
    expect(mail.subject).toContain('카드 등록');
    expect(mail.text).toContain('즉시 첫 달치가 결제되고');
  });

  it('change는 이번에 결제되지 않는다고 알린다 — 없는 청구를 예고하지 않는다', async () => {
    await sendSubscriptionSetupEmail(sub({ setupMode: 'change' }), 'https://studionol.co.kr/ko/subscribe/sub-1?token=t');
    const mail = lastCall();
    expect(mail.subject).toContain('카드 변경');
    expect(mail.text).not.toContain('즉시 첫 달치가 결제');
    expect(mail.text).toContain('이번에는 결제되지 않습니다');
    expect(mail.text).toContain('다음 결제일부터 새 카드로');
  });
});

/**
 * 해지·종료된 구독에 승인이 뒤늦게 도착하면 고객은 한 달치를 냈는데 이용기간은 전진하지
 * 않은 상태다 — 환불 기한이 도는 건이라 로그가 아니라 사람에게 닿아야 한다(PR #59의 교훈).
 */
it('운영자 알림에 late_approval 종류가 있다 — 제목만 보고 환불 판단 건임을 안다', async () => {
  await sendSubscriptionOperatorAlert(sub(), 'late_approval', '2026-04분 396,000원 승인 도착');
  const mail = lastCall();
  expect(mail.subject).toContain('환불 판단 필요');
  expect(mail.text).toContain('2026-04분');
  expect(mail.text).toContain('/admin/subscriptions/sub-1');
});
