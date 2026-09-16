/**
 * 관리자 첫 화면이 현황을 실제로 그리는지 — 점검 항목·대기열·이번 주 세션·장부 폼.
 * 현황 로딩이 죽어도 다른 관리 화면으로 가는 링크는 남아야 한다.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin', pathname: '/admin' }) }));
jest.mock('../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
// admin-auth는 iron-session(ESM)을 끌고 들어온다.
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../lib/ops/adminDashboard', () => ({
  ...jest.requireActual('../../../lib/ops/adminDashboard'),
  loadAdminDashboard: jest.fn(),
}));

import type { GetServerSidePropsContext } from 'next';
import AdminIndexPage, { getServerSideProps } from '../../../pages/admin/index';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { loadAdminDashboard, type AdminDashboard } from '../../../lib/ops/adminDashboard';

const DASHBOARD: AdminDashboard = {
  issues: [
    { severity: 'high', title: '해지된 구독에 결제가 남아 있는 건 1건 — 환불 판단 필요', detail: '주문번호: SNB-1', href: '/admin/subscriptions' },
    { severity: 'medium', title: '서명 기한이 지난 계약 2건', detail: '대상: 박연주' },
  ],
  upcomingSessions: [
    { orderId: 'o1', orderNo: 'SNB-2', customerName: '홍길동', productName: '보컬 녹음 1프로', startAt: '2026-09-17T05:00:00.000Z', endAt: '2026-09-17T08:00:00.000Z' },
  ],
  queues: { mixingReceived: 3, mixingInProgress: 1, subscriptionsPendingCard: 0, subscriptionsPastDue: 2, subscriptionsPaused: 0, contractsAwaitingSignature: 1 },
  socialTokens: [{ platform: 'ig', expiresAt: '2026-09-26T03:00:00.000Z', daysLeft: 10 }],
  upcomingWindowDays: 7,
  checkedAt: '2026-09-16T03:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
});

it('점검 항목은 심각도 배지와 처리 링크를, 대기열은 건수를, 세션은 일시·고객·상품을 그린다', () => {
  render(<AdminIndexPage dashboard={DASHBOARD} ledgerFrom="2026-09-01" ledgerTo="2026-09-16" />);

  expect(screen.getByText('긴급')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /해지된 구독에 결제가 남아 있는 건/ })).toHaveAttribute('href', '/admin/subscriptions');
  expect(screen.getByText('서명 기한이 지난 계약 2건')).toBeInTheDocument();

  expect(screen.getByRole('link', { name: /믹싱 착수 대기\s*3/ })).toHaveAttribute('href', '/admin/bookings');
  expect(screen.getByRole('link', { name: /결제 재시도 중 구독\s*2/ })).toBeInTheDocument();

  expect(screen.getByText('2026.09.17 (목) 14:00')).toBeInTheDocument();
  expect(screen.getByText('홍길동 · 보컬 녹음 1프로')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'SNB-2' })).toHaveAttribute('href', '/admin/bookings/o1');

  expect(screen.getByLabelText('시작일')).toHaveValue('2026-09-01');
  expect(screen.getByLabelText('종료일')).toHaveValue('2026-09-16');
  expect(screen.getByText('인스타그램: 만료까지 10일')).toBeInTheDocument();
});

it('현황 로딩이 실패하면 오류를 알리되 관리 화면 링크는 남는다', async () => {
  (loadAdminDashboard as jest.Mock).mockRejectedValue(new Error('db down'));
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as {
    props: { dashboard: AdminDashboard | null; ledgerFrom: string; ledgerTo: string; error?: string };
  };
  expect(result.props.dashboard).toBeNull();
  expect(result.props.error).toMatch(/불러오지 못했습니다/);

  render(<AdminIndexPage {...result.props} />);
  expect(screen.getByText(/불러오지 못했습니다/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '구독' })).toHaveAttribute('href', '/admin/subscriptions');
  expect(screen.queryByText('처리할 일')).not.toBeInTheDocument();
  // 장부는 현황과 무관하다 — 점검이 죽어도 정산 CSV는 받을 수 있어야 한다.
  expect(screen.getByLabelText('시작일')).toHaveValue(result.props.ledgerFrom);
});

it('getServerSideProps는 KST 기준 이번 달 1일부터 오늘까지를 장부 기본 기간으로 넘긴다', async () => {
  (loadAdminDashboard as jest.Mock).mockResolvedValue(DASHBOARD);

  const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as {
    props: { ledgerFrom: string; ledgerTo: string };
  };
  expect(result.props.ledgerFrom).toMatch(/^\d{4}-\d{2}-01$/);
  expect(result.props.ledgerTo.slice(0, 7)).toBe(result.props.ledgerFrom.slice(0, 7));
});
