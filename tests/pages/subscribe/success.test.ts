/** @jest-environment node */

jest.mock('../../../lib/billing/service', () => ({
  completeCardSetup: jest.fn(),
  getSubscriptionWithDetails: jest.fn(),
}));
jest.mock('../../../lib/billing/email', () => ({
  sendSubscriptionActivatedEmail: jest.fn().mockResolvedValue(null),
  sendSubscriptionOperatorAlert: jest.fn().mockResolvedValue(null),
  subscriptionManageUrl: jest.fn(() => '/ko/subscribe/manage/sub-1?token=mtok'),
}));

import { completeCardSetup, getSubscriptionWithDetails } from '../../../lib/billing/service';
import { sendSubscriptionActivatedEmail, sendSubscriptionOperatorAlert } from '../../../lib/billing/email';
import { getServerSideProps } from '../../../pages/[locale]/subscribe/[id]/success';

type Ctx = Parameters<typeof getServerSideProps>[0];
type Result = { props: Record<string, unknown> };

const run = async (query: Record<string, string>): Promise<Result> =>
  (await getServerSideProps({
    query,
    params: { locale: 'ko', id: 'sub-1' },
    res: { setHeader: jest.fn() },
  } as unknown as Ctx)) as unknown as Result;

const mockComplete = completeCardSetup as jest.Mock;
const mockDetails = getSubscriptionWithDetails as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('쿼리가 불완전하면 error, completeCardSetup을 부르지 않는다', async () => {
  const r = await run({ token: 'tok' });
  expect(r.props.outcome).toBe('error');
  expect(mockComplete).not.toHaveBeenCalled();
});

it('첫 결제까지 성공하면 activated + 관리 링크 + 확정 메일 발송', async () => {
  mockComplete.mockResolvedValue({ ok: true, status: 'active', charged: true, paymentKey: 'pk' });
  mockDetails.mockResolvedValue({
    subscription: { id: 'sub-1', kind: 'practice-room', totalAmount: 396000, billingDay: 5, manageToken: 'mtok' },
    billingKey: null,
    payments: [],
    contract: null,
  });
  const r = await run({ token: 'tok', customerKey: 'sub_abc', authKey: 'auth' });
  expect(r.props.outcome).toBe('activated');
  expect(r.props.manageUrl).toBe('/ko/subscribe/manage/sub-1?token=mtok');
  expect(sendSubscriptionActivatedEmail).toHaveBeenCalled();
});

it('카드 교체 모드는 결제 없이 card_changed, 확정 메일을 보내지 않는다', async () => {
  mockComplete.mockResolvedValue({ ok: true, status: 'active', charged: false });
  mockDetails.mockResolvedValue({
    subscription: { id: 'sub-1', kind: 'practice-room', totalAmount: 396000, billingDay: 5, manageToken: 'mtok' },
    billingKey: null,
    payments: [],
    contract: null,
  });
  const r = await run({ token: 'tok', customerKey: 'sub_abc', authKey: 'auth' });
  expect(r.props.outcome).toBe('card_changed');
  expect(sendSubscriptionActivatedEmail).not.toHaveBeenCalled();
});

it('첫 결제 실패는 운영자 알림을 보내고 first_charge_failed를 반환', async () => {
  mockComplete.mockResolvedValue({ ok: false, code: 'first_charge_failed', message: '카드 한도 초과' });
  mockDetails.mockResolvedValue({
    subscription: { id: 'sub-1', kind: 'lesson', customerName: '홍길동', customerPhone: '010-0000-0000' },
    billingKey: null,
    payments: [],
    contract: null,
  });
  const r = await run({ token: 'tok', customerKey: 'sub_abc', authKey: 'auth' });
  expect(r.props).toEqual({ outcome: 'first_charge_failed', message: '카드 한도 초과' });
  expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'sub-1' }),
    'first_charge_failed',
    '카드 한도 초과',
  );
});
