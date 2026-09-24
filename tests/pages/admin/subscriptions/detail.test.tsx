/**
 * 관리자 구독 상세가 **왜 정지됐는지**를 보여 주는지.
 *
 * `paused` 하나로는 "결제가 계속 거절돼 시스템이 세운 것"과 "운영자가 청구만 멈춰 둔 것"이
 * 구분되지 않는다. 둘은 해야 할 일이 정반대라(카드 재등록 안내 / 그대로 두기) 화면에서
 * 갈라 보이지 않으면 운영자가 판단할 근거가 없다.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), asPath: '/admin/subscriptions/s1', pathname: '/admin/subscriptions/[id]' }),
}));
jest.mock('../../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../../lib/billing/service', () => ({ getSubscriptionWithDetails: jest.fn() }));
jest.mock('../../../../lib/billing/refund', () => ({ listSubscriptionRefundSummary: jest.fn() }));

import AdminSubscriptionDetailPage from '../../../../pages/admin/subscriptions/[id]';
import type { SerializedSubscription } from '../../../../lib/billing/admin-serialize';

const subscription = (over: Partial<SerializedSubscription>): SerializedSubscription =>
  ({
    id: 's1',
    kind: 'lesson',
    contractId: null,
    customerName: '김수강',
    customerPhone: '010-1234-5678',
    customerEmail: 'student@example.com',
    customerKey: 'sub_k',
    itemAmount: 360000,
    vatAmount: 36000,
    totalAmount: 396000,
    billingDay: 5,
    status: 'paused',
    pausedReason: null,
    billingKeyId: null,
    nextBillingAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    setupToken: null,
    setupTokenExpiresAt: null,
    setupMode: 'initial',
    manageToken: 'mtok',
    artistSlug: null,
    tierId: null,
    displayName: null,
    displayConsent: false,
    cancelledAt: null,
    cancelReason: null,
    endsAt: null,
    notificationError: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as SerializedSubscription;

const renderWith = (over: Partial<SerializedSubscription>) =>
  render(
    <AdminSubscriptionDetailPage
      subscription={subscription(over)}
      billingKey={null}
      payments={[]}
      refundSummary={[]}
      contract={null}
    />,
  );

it('운영자 정지와 결제 실패 정지를 다른 문구로 보여 준다', () => {
  const { unmount } = renderWith({ pausedReason: 'operator' });
  expect(screen.getByText('운영자가 청구를 멈춤')).toBeInTheDocument();
  unmount();

  renderWith({ pausedReason: 'payment_failed' });
  expect(screen.getByText('결제 재시도 한도 소진')).toBeInTheDocument();
});

it('사유가 기록되기 전에 정지된 구독은 모른다고 적는다 — 둘 중 하나로 단정하지 않는다', () => {
  renderWith({ pausedReason: null });
  expect(screen.getByText('정지 사유 기록 없음')).toBeInTheDocument();
});

it('정지가 아닌 구독에는 사유 배지가 없다', () => {
  renderWith({ status: 'active', pausedReason: null });
  expect(screen.queryByText('정지 사유 기록 없음')).not.toBeInTheDocument();
  expect(screen.queryByText('운영자가 청구를 멈춤')).not.toBeInTheDocument();
});
