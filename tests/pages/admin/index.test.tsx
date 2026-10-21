/**
 * 관리자 첫 화면이 현황을 실제로 그리는지 — 점검 항목·대기열·이번 주 세션·장부 폼.
 * 현황 로딩이 죽어도 다른 관리 화면으로 가는 링크는 남아야 한다.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin', pathname: '/admin' }) }));
jest.mock('../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
// admin-auth는 iron-session(ESM)을 끌고 들어온다.
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../lib/ops/adminDashboard', () => ({
  ...jest.requireActual('../../../lib/ops/adminDashboard'),
  loadAdminDashboard: jest.fn(),
}));

jest.mock('../../../lib/ops/revenueSnapshot', () => ({ loadRevenueSnapshot: jest.fn() }));

import type { GetServerSidePropsContext } from 'next';
import AdminIndexPage, { getServerSideProps } from '../../../pages/admin/index';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { loadAdminDashboard, type AdminDashboard } from '../../../lib/ops/adminDashboard';
import { loadRevenueSnapshot, type RevenueSnapshot } from '../../../lib/ops/revenueSnapshot';

const DASHBOARD: AdminDashboard = {
  issues: [
    { severity: 'high', title: '구독이 끝난 뒤에 들어온 결제 1건 — 환불 판단 필요', detail: '주문번호: SNB-1', href: '/admin/subscriptions' },
    { severity: 'medium', title: '서명 기한이 지난 계약 2건', detail: '대상: 박연주' },
  ],
  calendarEvents: [],
  calendarError: null,
  upcomingSessions: [
    { kind: 'booking' as const, orderId: 'o1', orderNo: 'SNB-2', customerName: '홍길동', productName: '보컬 녹음 3시간', startAt: '2026-09-17T05:00:00.000Z', endAt: '2026-09-17T08:00:00.000Z' },
  ],
  queues: {
    mixingReceived: 3,
    mixingInProgress: 1,
    subscriptionsPendingCard: 0,
    subscriptionsPastDue: 2,
    subscriptionsPaused: 0,
    contractsAwaitingSignature: 1,
    contractsAwaitingTermination: 2,
    artistPayoutsPending: 0,
    fundingProjectsAwaitingReview: 4,
    fundingPayoutsPending: 2,
    fundingPayoutsToRecord: 1,
    shopPayoutsToRecord: 2,
    shopPayoutsPending: 1,
    showPayoutsToRecord: 3,
    showPayoutsPending: 2,
    fundingRefundRequests: 1,
    awaitingDeposit: { bookings: 3, shows: 0, shop: 1, funding: 2 },
    sessionsAwaitingMark: 3,
    showSubmissionsAwaitingReview: 2,
    sessionMusiciansNew: 3,
  },
  socialTokens: [{ platform: 'ig', expiresAt: '2026-09-26T03:00:00.000Z', daysLeft: 10 }],
  upcomingWindowDays: 7,
  checkedAt: '2026-09-16T03:00:00.000Z',
};

const REVENUE: RevenueSnapshot = {
  year: 2026, month: 10, net: 1_250_000, gross: 1_300_000, refunded: 50_000, count: 7,
  previousNet: 1_000_000, changeRate: 25, directNet: 900_000, brokeredNet: 350_000, manualMissing: false, practiceIncome: 3_786_000, practiceExpense: 1_000_000, tenancyMissing: false,
};

const SHOP_QUEUES = { pendingProducts: 2, awaitingShipment: { studio: 5, preorder: 1, artist: 2 } };

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
  (loadRevenueSnapshot as jest.Mock).mockResolvedValue(REVENUE);
});

it('점검 항목은 심각도 배지와 처리 링크를, 대기열은 건수를, 세션은 일시·고객·상품을 그린다', () => {
  render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} ledgerFrom="2026-09-01" ledgerTo="2026-09-16" />);

  expect(screen.getByText('긴급')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /구독이 끝난 뒤에 들어온 결제/ })).toHaveAttribute('href', '/admin/subscriptions');
  expect(screen.getByText('서명 기한이 지난 계약 2건')).toBeInTheDocument();

  expect(screen.getByRole('link', { name: /믹싱 착수 대기\s*3/ })).toHaveAttribute('href', '/admin/bookings?work=received');
  expect(screen.getByRole('link', { name: /믹싱 작업 중\s*1/ })).toHaveAttribute('href', '/admin/bookings?work=in_progress');
  expect(screen.getByRole('link', { name: /완료·노쇼 표시 대기 세션\s*3/ })).toHaveAttribute('href', '/admin/bookings?session=unmarked');
  expect(screen.getByRole('link', { name: /심사 대기 주최자 공연\s*2/ })).toHaveAttribute('href', '/admin/shows/submissions');
  expect(screen.getByRole('link', { name: /새 세션 연주자 등록\s*3/ })).toHaveAttribute('href', '/admin/session-musicians?status=new');
  expect(screen.getByRole('link', { name: /서명 대기 계약\s*1/ })).toHaveAttribute('href', '/admin/contracts?status=sent');
  expect(screen.getByRole('link', { name: /종료 처리 필요 계약\s*2/ })).toHaveAttribute('href', '/admin/contracts?status=termination');
  expect(screen.getByRole('link', { name: /결제 재시도 중 구독\s*2/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /심사 대기 펀딩 프로젝트\s*4/ })).toHaveAttribute('href', '/admin/funding/projects');
  expect(screen.getByRole('link', { name: /심사 대기 상점 상품\s*2/ })).toHaveAttribute('href', '/admin/shop/products');
  expect(screen.getByRole('link', { name: /^발송 대기 상점 주문\s*5/ })).toHaveAttribute('href', '/admin/shop');
  // 스튜디오가 지금 보낼 주문과 따로 — 예약 발송일 전·아티스트 발송.
  expect(screen.getByRole('link', { name: /예약 발송일 전 상점 주문\s*1/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /아티스트 발송 대기 상점 주문\s*2/ })).toBeInTheDocument();

  expect(screen.getByText('2026.09.17 (목) 14:00')).toBeInTheDocument();
  expect(screen.getByText('홍길동 · 보컬 녹음 3시간')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'SNB-2' })).toHaveAttribute('href', '/admin/bookings/o1');

  expect(screen.getByLabelText('시작일')).toHaveValue('2026-09-01');
  expect(screen.getByLabelText('종료일')).toHaveValue('2026-09-16');
  expect(screen.getByText('인스타그램: 만료까지 10일')).toBeInTheDocument();
});

it('상점 건수를 못 읽으면(표 없음·오류) 그 카드만 숨기고 나머지는 그대로 그린다', () => {
  render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={{ pendingProducts: null, awaitingShipment: null }} ledgerFrom="2026-09-01" ledgerTo="2026-09-16" />);
  expect(screen.queryByText('심사 대기 상점 상품')).not.toBeInTheDocument();
  expect(screen.queryByText('발송 대기 상점 주문')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /믹싱 착수 대기\s*3/ })).toBeInTheDocument();
});

it('현황 로딩이 실패하면 오류를 알리되 관리 화면 링크는 남는다', async () => {
  (loadAdminDashboard as jest.Mock).mockRejectedValue(new Error('db down'));
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as {
    props: { dashboard: AdminDashboard | null; shopQueues: { pendingProducts: number | null; awaitingShipment: { studio: number; preorder: number; artist: number } | null }; ledgerFrom: string; ledgerTo: string; error?: string };
  };
  expect(result.props.dashboard).toBeNull();
  expect(result.props.error).toMatch(/불러오지 못했습니다/);

  render(<AdminIndexPage {...result.props} />);
  expect(screen.getByText(/불러오지 못했습니다/)).toBeInTheDocument();
  // 구역 링크는 묶음(드롭다운) 안에 있다 — 열면 닿는다.
  fireEvent.click(screen.getByRole('button', { name: '연습실' }));
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

describe('이번 달 매출 요약', () => {
  it('순매출·전월 대비·직접/중개 구성을 그리고 매출 현황으로 잇는다', () => {
    render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} revenue={REVENUE} ledgerFrom="2026-10-01" ledgerTo="2026-10-16" />);
    expect(screen.getByRole('heading', { name: '10월 매출' })).toBeInTheDocument();
    expect(screen.getByText('1,250,000원')).toBeInTheDocument();
    expect(screen.getByText(/25\.0% 전월\(1,000,000원\)/)).toBeInTheDocument();
    expect(screen.getByText('900,000원')).toBeInTheDocument();
    expect(screen.getByText('350,000원')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /매출 현황/ })).toHaveAttribute('href', '/admin/revenue');
  });

  it('전월 매출이 없으면 비교하지 않고, 수기 표를 못 읽었으면 알린다', () => {
    render(
      <AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} revenue={{ ...REVENUE, changeRate: null, previousNet: 0, manualMissing: true }} ledgerFrom="2026-10-01" ledgerTo="2026-10-16" />,
    );
    expect(screen.getByText(/전월 매출이 없어/)).toBeInTheDocument();
    expect(screen.getByText(/직접 받은 매출 표를 읽지 못해/)).toBeInTheDocument();
  });

  it('매출 조회가 실패해도 첫 화면은 그대로 뜬다 — 카드만 빠진다', async () => {
    (loadRevenueSnapshot as jest.Mock).mockRejectedValue(new Error('db down'));
    (loadAdminDashboard as jest.Mock).mockResolvedValue(DASHBOARD);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as { props: React.ComponentProps<typeof AdminIndexPage> };
    expect(result.props.revenue).toBeNull();
    render(<AdminIndexPage {...result.props} />);
    expect(screen.queryByText(/월 매출/)).not.toBeInTheDocument();
    expect(screen.getByText('처리할 일')).toBeInTheDocument();
  });
});

describe('놓치기 쉬운 대기열 — 마감 뒤 정산 기록, 계좌 입금 대기', () => {
  it('정산 기록 대기와 종류별 입금 대기를 건수·이동 링크와 함께 그린다', () => {
    render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} ledgerFrom="2026-09-01" ledgerTo="2026-09-16" />);

    expect(screen.getByRole('link', { name: /정산 기록 대기 펀딩 \(마감됨\)\s*1/ })).toHaveAttribute('href', '/admin/funding/projects?payout=record');
    expect(screen.getByRole('link', { name: /이체 대기 펀딩 정산\s*2/ })).toHaveAttribute('href', '/admin/funding/projects?payout=pending');
    expect(screen.getByRole('link', { name: /환불 요청 펀딩 후원\s*1/ })).toHaveAttribute('href', '/admin/funding');
    expect(screen.getByRole('link', { name: /입금 대기 예약·믹싱\s*3/ })).toHaveAttribute('href', '/admin/bookings?deposit=pending');
    expect(screen.getByRole('link', { name: /입금 대기 펀딩\s*2/ })).toHaveAttribute('href', '/admin/funding?deposit=pending');
    expect(screen.getByRole('link', { name: /입금 대기 공연 티켓\s*0/ })).toHaveAttribute('href', '/admin/shows');
    expect(screen.getByRole('link', { name: /입금 대기 상점 주문\s*1/ })).toHaveAttribute('href', '/admin/shop');
    expect(screen.getByRole('link', { name: /정산 기록 대기 상점 \(지난 달\)\s*2/ })).toHaveAttribute('href', '/admin/shop');
    expect(screen.getByRole('link', { name: /이체 대기 상점 정산\s*1/ })).toHaveAttribute('href', '/admin/shop');
    expect(screen.getByRole('link', { name: /정산 기록 대기 공연 \(종료됨\)\s*3/ })).toHaveAttribute('href', '/admin/shows');
    expect(screen.getByRole('link', { name: /이체 대기 공연 정산\s*2/ })).toHaveAttribute('href', '/admin/shows');
  });
});
