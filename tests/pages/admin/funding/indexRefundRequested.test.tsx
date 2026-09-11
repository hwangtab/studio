/**
 * 무통장 셀프 취소는 refundRequestedAt만 찍고 orders.status는 paid로 남긴다(자동 환불
 * 경로가 없어 운영자가 계좌로 보내야 하기 때문). 그 값이 관리자 상세 한 줄에만 있던 동안
 * 목록 화면은 이 건을 정상 확정 건과 똑같이 그렸고, 운영자는 그대로 발송했다.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/funding' }) }));
jest.mock('../../../../components/admin/fundingActions', () => ({ createManualPledge: jest.fn() }));
jest.mock('../../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
// admin-auth는 iron-session(ESM)을 끌고 들어온다.
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../../lib/funding/projects', () => ({ getAllFundingProjects: jest.fn(() => []) }));
jest.mock('../../../../lib/funding/admin-list', () => ({
  listFundingOrders: jest.fn(),
  aggregateAdminFundingTotals: jest.fn().mockResolvedValue({
    confirmedAmount: 0, confirmedCount: 0, confirmedPersonCount: 0, pendingAmount: 0, pendingCount: 0,
  }),
}));
jest.mock('../../../../lib/funding/service', () => ({ expireStalePledges: jest.fn() }));

import type { GetServerSidePropsContext } from 'next';
import AdminFundingPage, { getServerSideProps } from '../../../../pages/admin/funding/index';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { aggregateAdminFundingTotals, listFundingOrders } from '../../../../lib/funding/admin-list';
import type { AdminPledgeItem } from '../../../../lib/funding/admin-serialize';

const NOW = new Date('2026-10-15T03:00:00Z');

const ITEM: AdminPledgeItem = {
  id: 'o1', orderNo: 'FND-1', projectSlug: 'demo', status: 'paid', paymentMethod: 'toss',
  entrySource: 'online', customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@b.com',
  rewardTitle: 'CD', quantity: 1, additionalAmount: 0, totalAmount: 30000, fulfillmentStatus: 'none',
  trackingCompany: null, trackingNumber: null, shipping: null, supporterMessage: null,
  refundRequestedAt: null, paidAt: null, holdExpiresAt: NOW.toISOString(), createdAt: NOW.toISOString(),
  adminMemo: null, notificationError: null, hasPayment: true, mismatch: false,
  refundRequested: false, needsReview: false,
};

const baseProps = {
  truncated: false,
  projects: [],
  slug: null,
  totals: { confirmedAmount: 0, confirmedCount: 0, confirmedPersonCount: 0, pendingAmount: 0, pendingCount: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
});

it('getServerSideProps가 환불 요청 건에 refundRequested: true를 실어 보낸다', async () => {
  (listFundingOrders as jest.Mock).mockResolvedValue([
    {
      id: 'o1', orderNo: 'FND-1', status: 'paid', totalAmount: 30000, customerName: '김후원',
      customerPhone: '010-1', customerEmail: 'a@b.com', notificationError: null, createdAt: NOW,
      payments: [],
      fundingPledge: {
        id: 'p1', projectSlug: 'demo', paymentMethod: 'bank_transfer', entrySource: 'online',
        rewardTitle: 'CD', quantity: 1, additionalAmount: 0, fulfillmentStatus: 'none',
        trackingCompany: null, trackingNumber: null, shippingAddress1: null, supporterMessage: null,
        refundRequestedAt: new Date('2026-10-14T02:00:00Z'), paidAt: null, holdExpiresAt: NOW, adminMemo: null,
      },
    },
  ]);
  const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as {
    props: { items: AdminPledgeItem[] };
  };
  expect(result.props.items[0].refundRequested).toBe(true);
  // 상태는 여전히 paid다 — 그래서 상태 칸만으로는 절대 드러나지 않는다.
  expect(result.props.items[0].status).toBe('paid');
});

it('getServerSideProps: 환불이 끝난 건은 refundRequested가 false다', async () => {
  (listFundingOrders as jest.Mock).mockResolvedValue([
    {
      id: 'o1', orderNo: 'FND-1', status: 'refunded', totalAmount: 30000, customerName: '김후원',
      customerPhone: '010-1', customerEmail: 'a@b.com', notificationError: null, createdAt: NOW,
      payments: [],
      fundingPledge: {
        id: 'p1', projectSlug: 'demo', paymentMethod: 'bank_transfer', entrySource: 'online',
        rewardTitle: 'CD', quantity: 1, additionalAmount: 0, fulfillmentStatus: 'none',
        trackingCompany: null, trackingNumber: null, shippingAddress1: null, supporterMessage: null,
        refundRequestedAt: new Date('2026-10-14T02:00:00Z'), paidAt: null, holdExpiresAt: NOW, adminMemo: null,
      },
    },
  ]);
  const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as {
    props: { items: AdminPledgeItem[] };
  };
  expect(result.props.items[0].refundRequested).toBe(false);
});

it('환불 요청 건은 상태 칸에 배지가, 상단에 대기 건수 배너가 뜬다', () => {
  render(<AdminFundingPage {...baseProps} items={[{ ...ITEM, refundRequested: true }]} />);
  expect(screen.getByText('환불요청')).toBeInTheDocument();
  expect(screen.getByText('1건이 계좌 환불 대기 중입니다')).toBeInTheDocument();
  expect(screen.getByText(/발송하면 안 됩니다/)).toBeInTheDocument();
});

// 환불을 처리해도 refundRequestedAt은 남는다(cancel.ts가 지우지 않는다) — 직렬화가
// 게이트하지 않으면 첫 환불 다음 날부터 배너가 영구히 켜져 신호가 죽는다.
it('환불이 끝난 건은 배지도 배너도 뜨지 않는다', () => {
  render(
    <AdminFundingPage
      {...baseProps}
      items={[{ ...ITEM, status: 'refunded', refundRequested: false, refundRequestedAt: '2026-10-14T02:00:00Z' }]}
    />,
  );
  expect(screen.queryByText('환불요청')).not.toBeInTheDocument();
  expect(screen.queryByText(/계좌 환불 대기 중/)).not.toBeInTheDocument();
});

it('환불 요청이 없으면 배지도 배너도 없다', () => {
  render(<AdminFundingPage {...baseProps} items={[ITEM]} />);
  expect(screen.queryByText('환불요청')).not.toBeInTheDocument();
  expect(screen.queryByText(/계좌 환불 대기 중/)).not.toBeInTheDocument();
});

/**
 * 웹훅이 만료·failed 주문을 되살려 확정한 건은 한정 리워드 재고를 초과했을 수 있다.
 * confirm.ts가 adminMemo에 흔적을 남겨도 목록 화면 어디에도 안 보이면 아무도 확인하지
 * 않는다 — 배지와 배너가 그 흔적을 실무 동선 위로 끌어올린다.
 */
it('재고 초과 가능 건은 상태 칸에 배지가, 상단에 배너가 뜬다', () => {
  render(<AdminFundingPage {...baseProps} items={[{ ...ITEM, needsReview: true }]} />);
  expect(screen.getByText('재고확인')).toBeInTheDocument();
  expect(screen.getByText('웹훅이 되살려 확정한 후원이 1건 있습니다')).toBeInTheDocument();
  expect(screen.getByText(/재고를 초과했을 수 있습니다/)).toBeInTheDocument();
});

it('평범한 건에는 재고확인 배지도 배너도 없다', () => {
  render(<AdminFundingPage {...baseProps} items={[ITEM]} />);
  expect(screen.queryByText('재고확인')).not.toBeInTheDocument();
  expect(screen.queryByText(/웹훅이 되살려 확정한/)).not.toBeInTheDocument();
});

it('getServerSideProps가 웹훅 메모가 있는 건에 needsReview: true를 실어 보낸다', async () => {
  (listFundingOrders as jest.Mock).mockResolvedValue([
    {
      id: 'o1', orderNo: 'FND-1', status: 'paid', totalAmount: 30000, customerName: '김후원',
      customerPhone: '010-1', customerEmail: 'a@b.com', notificationError: null, createdAt: NOW,
      payments: [],
      fundingPledge: {
        id: 'p1', projectSlug: 'demo', paymentMethod: 'toss', entrySource: 'online',
        rewardTitle: 'CD', quantity: 1, additionalAmount: 0, fulfillmentStatus: 'none',
        trackingCompany: null, trackingNumber: null, shippingAddress1: null, supporterMessage: null,
        refundRequestedAt: null, paidAt: null, holdExpiresAt: NOW,
        adminMemo: '[웹훅] 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요',
      },
    },
  ]);
  const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as {
    props: { items: AdminPledgeItem[] };
  };
  expect(result.props.items[0].needsReview).toBe(true);
});

/**
 * 상단 KPI는 서버 집계에서 온다 — 목록에서 계산하면 201건째부터 공개 진행률과 갈라진다.
 * getServerSideProps가 그 집계를 실제로 불러 props에 싣는지 확인한다.
 */
it('getServerSideProps가 집계 SQL 결과를 totals로 내려보낸다', async () => {
  (listFundingOrders as jest.Mock).mockResolvedValue([]);
  (aggregateAdminFundingTotals as jest.Mock).mockResolvedValue({
    confirmedAmount: 9_000_000, confirmedCount: 401, confirmedPersonCount: 350, pendingAmount: 5000, pendingCount: 1,
  });
  const result = (await getServerSideProps({ query: { slug: 'demo' } } as unknown as GetServerSidePropsContext)) as {
    props: { totals: { confirmedCount: number } };
  };
  expect(aggregateAdminFundingTotals).toHaveBeenCalledWith('demo');
  expect(result.props.totals.confirmedCount).toBe(401);
});
