jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

import { sendEmail } from '../email/resend';
import {
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionChargedEmail,
  sendSubscriptionChargeFailedEmail,
  sendSubscriptionOperatorAlert,
  sendSubscriptionRefundedEmail,
  sendSubscriptionResumedEmail,
  sendSubscriptionSetupEmail,
} from './email';
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

/**
 * 일시정지(paused) 구독은 카드를 새로 등록해도 자동으로 재개되지 않는다 —
 * `listDueSubscriptions`가 active·past_due만 집어 간다. 그 상태에 "다음 결제일부터 새
 * 카드로 청구됩니다"라고 쓰면 위 describe가 고친 것과 **같은 종류의 거짓**이 된다.
 */
describe('sendSubscriptionSetupEmail — 일시정지 구독', () => {
  it('paused에는 다음 결제일 청구를 예고하지 않는다', async () => {
    await sendSubscriptionSetupEmail(
      sub({ setupMode: 'change', status: 'paused' }),
      'https://studionol.co.kr/ko/subscribe/sub-1?token=t',
    );
    const mail = lastCall();
    expect(mail.text).toContain('이번에는 결제되지 않습니다');
    expect(mail.text).not.toContain('다음 결제일부터');
    expect(mail.text).toContain('멈춰 있는 상태');
  });

  it('active는 종전대로 다음 결제일 청구를 알린다', async () => {
    await sendSubscriptionSetupEmail(
      sub({ setupMode: 'change', status: 'active' }),
      'https://studionol.co.kr/ko/subscribe/sub-1?token=t',
    );
    expect(lastCall().text).toContain('다음 결제일부터');
  });
});

/**
 * 보관 기간이 지난 구독은 이메일 칸이 파기 표식으로 덮인다
 * (`lib/privacy/orderRetention.ts`). 그 주소로 보내려 들면 실패 문자열이
 * `notificationError`에 박혀 꺼지지 않는 경보가 된다 — 예약·펀딩 쪽과 같은 방어다.
 */
describe('파기된 주소에는 고객 메일을 보내지 않는다', () => {
  const PURGED = '(개인정보 파기됨)';

  it('발송을 시도하지 않고, 실패로도 세지 않는다', async () => {
    const result = await sendSubscriptionSetupEmail(
      sub({ customerEmail: PURGED }),
      'https://studionol.co.kr/ko/subscribe/sub-1?token=t',
    );
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('운영자 알림은 그대로 나간다 — 주소가 우리 것이라 파기와 무관하다', async () => {
    await sendSubscriptionOperatorAlert(sub({ customerEmail: PURGED }), 'paused', '방치 종료');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe('구독 메일 HTML — 공용 레이아웃', () => {
  const cust = { kind: 'lesson', customerName: '김<b>수강', customerEmail: 'student@studio.test', customerPhone: '010-1234-5678', artistSlug: null, totalAmount: 396000, billingDay: 5 } as unknown as Subscription;
  const manageUrl = 'https://studionol.co.kr/ko/subscribe/manage/sub-1?token=t';

  it('고객 7종 모두 text와 함께 html이 나가고 핵심 값·버튼이 든다', async () => {
    const calls: Array<[string, () => Promise<unknown>, string[]]> = [
      ['setup', () => sendSubscriptionSetupEmail(cust, 'https://x/setup?token=t'), ['https://x/setup?token=t', '396,000']],
      ['activated', () => sendSubscriptionActivatedEmail(cust, { manageUrl, amount: 396000 }), [manageUrl, '396,000']],
      ['charged', () => sendSubscriptionChargedEmail(cust, { amount: 396000, cycleYm: '2026-10', manageUrl }), [manageUrl, '2026-10']],
      ['failed', () => sendSubscriptionChargeFailedEmail(cust, { amount: 396000, cycleYm: '2026-10', nextRetryAt: null, manageUrl, cardChangeHint: '카드를 바꿔 주세요' }), [manageUrl, '카드 변경하기', '재등록']],
      ['resumed', () => sendSubscriptionResumedEmail(cust, { nextBillingAt: new Date('2026-11-05T00:00:00Z'), manageUrl }), [manageUrl, '2026']],
      ['cancelled', () => sendSubscriptionCancelledEmail(cust, { endsAt: new Date('2026-11-05T00:00:00Z') }), ['2026']],
      ['refunded', () => sendSubscriptionRefundedEmail(cust, { amount: 100000, cycleYm: '2026-10', orderNo: 'SUB-1', isFull: false, manageUrl }), [manageUrl, '100,000', 'SUB-1']],
    ];
    for (const [name, run, needles] of calls) {
      await run();
      const mail = lastCall();
      expect(mail.html).toContain('<!DOCTYPE html>');
      expect(mail.text).toBeTruthy();
      for (const n of needles) expect(`${name}:${mail.html}`).toContain(n);
      expect(mail.html).not.toContain('김<b>수강');
      expect(mail.html).toContain('김&lt;b&gt;수강');
    }
  });

  it('결제 실패 메일은 카드 변경을 버튼으로, 붉은 안내 톤으로 보낸다', async () => {
    await sendSubscriptionChargeFailedEmail(cust, { amount: 396000, cycleYm: '2026-10', nextRetryAt: new Date('2026-10-08T00:00:00Z'), manageUrl, cardChangeHint: 'h' });
    const { html } = lastCall();
    expect(html).toContain(`href="${manageUrl}"`);
    expect(html).toContain('카드 변경하기');
    expect(html).toContain('#f87171');
  });

  it('운영자 알림은 관리자 딥링크 버튼과 tel 링크를 담고 detail을 escape한다', async () => {
    await sendSubscriptionOperatorAlert({ ...cust, id: 'sub-1' }, 'first_charge_failed', '사유 <script>x</script>\n둘째 줄');
    const mail = lastCall();
    expect(mail.html).toContain('/admin/subscriptions/sub-1"');
    expect(mail.html).toContain('관리자에서 보기');
    expect(mail.html).toContain('href="tel:01012345678"');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('둘째 줄');
    expect(mail.html).toContain('운영 알림');
  });
});
