/**
 * 관리자 첫 화면이 현황을 실제로 그리는지 — 요약·처리할 일·대기 작업 묶음·일정·이번 달 수익.
 * 현황 로딩이 죽어도 다른 관리 화면으로 가는 메뉴는 남아야 한다. 장부 CSV는 재무 › 장부 내보내기로 옮겼다.
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
    { kind: 'booking' as const, orderId: 'o0', orderNo: 'SNB-1', customerName: '김오늘', productName: '연습실 2시간', startAt: '2026-09-16T06:00:00.000Z', endAt: '2026-09-16T08:00:00.000Z' },
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
    lessons: { unmarked: 1, today: 2 },
  },
  socialTokens: [{ platform: 'ig', expiresAt: '2026-09-26T03:00:00.000Z', daysLeft: 10 }],
  upcomingWindowDays: 7,
  checkedAt: '2026-09-16T03:00:00.000Z',
};

const REVENUE: RevenueSnapshot = {
  year: 2026, month: 10, net: 1_250_000, gross: 1_300_000, refunded: 50_000, count: 7,
  previousNet: 1_000_000, changeRate: 25, manualMissing: false, tenancyMissing: false,
  lines: [
    { line: 'practice', label: '연습실', net: 500_000, expense: 200_000, profit: 300_000 },
    { line: 'recording', label: '녹음·제작', net: 400_000, expense: 0, profit: 400_000 },
    { line: 'platform', label: '플랫폼', net: 350_000, expense: 0, profit: 350_000 },
    { line: 'other', label: '기타', net: 0, expense: 0, profit: 0 },
  ],
  commonExpense: 50_000, expenseTotal: 250_000, totalProfit: 1_000_000, lessonMissing: false,
};

const SHOP_QUEUES = { pendingProducts: 2, awaitingShipment: { studio: 5, preorder: 1, artist: 2 } };

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
  (loadRevenueSnapshot as jest.Mock).mockResolvedValue(REVENUE);
});

it('맨 위 요약은 긴급·확인·대기 작업·오늘 일정 건수를 그 칸으로 잇는다', () => {
  render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} />);
  expect(screen.getByRole('link', { name: /^긴급\s*1/ })).toHaveAttribute('href', '#todo');
  expect(screen.getByRole('link', { name: /^확인\s*1/ })).toHaveAttribute('href', '#todo');
  // 대기 작업 = 0이 아닌 할 일 건수 합(상태인 믹싱 작업 중·예약 발송 전·아티스트 발송은 빼고).
  expect(screen.getByRole('link', { name: /^대기 작업\s*46/ })).toHaveAttribute('href', '#queues');
  // 오늘 일정 = 오늘 세션 1 + 오늘 레슨 2.
  expect(screen.getByRole('link', { name: /^오늘 일정\s*3/ })).toHaveAttribute('href', '#schedule');
});

it('점검 항목은 심각도 배지와 처리 링크를, 대기 작업은 묶음별 건수를, 일정은 오늘·이번 주로 나눠 그린다', () => {
  render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} />);

  expect(screen.getAllByText('긴급').length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: /구독이 끝난 뒤에 들어온 결제/ })).toHaveAttribute('href', '/admin/subscriptions');
  expect(screen.getByText('서명 기한이 지난 계약 2건')).toBeInTheDocument();

  for (const title of ['입금 확인', '환불·정산 송금', '기록·발송', '심사·확인', '계약·구독']) {
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  }
  expect(screen.getByRole('link', { name: /믹싱 착수 대기\s*3/ })).toHaveAttribute('href', '/admin/bookings?work=received');
  expect(screen.getByRole('link', { name: /완료·노쇼 표시 대기 세션\s*3/ })).toHaveAttribute('href', '/admin/bookings?session=unmarked');
  expect(screen.getByRole('link', { name: /심사 대기 주최자 공연\s*2/ })).toHaveAttribute('href', '/admin/shows/submissions');
  expect(screen.getByRole('link', { name: /새 세션 연주자 등록\s*3/ })).toHaveAttribute('href', '/admin/session-musicians?status=new');
  expect(screen.getByRole('link', { name: /서명 대기 계약\s*1/ })).toHaveAttribute('href', '/admin/contracts?status=sent');
  expect(screen.getByRole('link', { name: /종료 처리 필요 계약\s*2/ })).toHaveAttribute('href', '/admin/contracts?status=termination');
  expect(screen.getByRole('link', { name: /결제 재시도 중 구독\s*2/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /심사 대기 펀딩 프로젝트\s*4/ })).toHaveAttribute('href', '/admin/funding/projects');
  expect(screen.getByRole('link', { name: /심사 대기 상점 상품\s*2/ })).toHaveAttribute('href', '/admin/shop/products');
  expect(screen.getByRole('link', { name: /^발송 대기 상점 주문\s*5/ })).toHaveAttribute('href', '/admin/shop');
  expect(screen.getByRole('link', { name: /완료·결석 표시 대기 레슨\s*1/ })).toHaveAttribute('href', '/admin/lessons');
  // 0건은 숨긴다(카드 등록 대기 구독·정지된 구독·아티스트 정산·공연 입금 대기).
  expect(screen.queryByText('카드 등록 대기 구독')).not.toBeInTheDocument();
  expect(screen.queryByText('입금 대기 공연 티켓')).not.toBeInTheDocument();

  // 상태(할 일 아님)는 일정 칸의 "진행 중"으로.
  expect(screen.getByRole('link', { name: /믹싱 작업 중\s*1/ })).toHaveAttribute('href', '/admin/bookings?work=in_progress');
  expect(screen.getByRole('link', { name: /예약 발송일 전 상점 주문\s*1/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /아티스트 발송 대기 상점 주문\s*2/ })).toBeInTheDocument();

  // 오늘 세션은 시각만, 이번 주는 날짜까지. 줄 전체가 예약 상세로 가는 링크다.
  expect(screen.getByRole('link', { name: /^15:00–17:00.*김오늘.*SNB-1/ })).toHaveAttribute('href', '/admin/bookings/o0');
  expect(screen.getByRole('link', { name: /2026\.09\.17 \(목\) 14:00–17:00.*홍길동 · 보컬 녹음 3시간.*SNB-2/ })).toHaveAttribute('href', '/admin/bookings/o1');
  expect(screen.getByRole('link', { name: /오늘 레슨 2회/ })).toHaveAttribute('href', '/admin/lessons');

  expect(screen.getByText('인스타그램: 만료까지 10일')).toBeInTheDocument();
  // 장부 폼은 재무로 옮겼다 — 첫 화면에는 그 길만 남는다.
  expect(screen.queryByLabelText('시작일')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '재무 › 장부 내보내기' })).toHaveAttribute('href', '/admin/finance/export');
});

it('상점 건수를 못 읽으면(표 없음·오류) 그 항목만 숨기고 나머지는 그대로 그린다', () => {
  render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={{ pendingProducts: null, awaitingShipment: null }} />);
  expect(screen.queryByText('심사 대기 상점 상품')).not.toBeInTheDocument();
  expect(screen.queryByText('발송 대기 상점 주문')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /믹싱 착수 대기\s*3/ })).toBeInTheDocument();
});

it('할 일이 하나도 없으면 빈 칸 대신 그렇다고 말한다', () => {
  const idle: AdminDashboard = {
    ...DASHBOARD,
    issues: [],
    queues: Object.fromEntries(
      Object.entries(DASHBOARD.queues).map(([k, v]) => [k, typeof v === 'number' ? 0 : v]),
    ) as unknown as AdminDashboard['queues'],
  };
  idle.queues.awaitingDeposit = { bookings: 0, shows: 0, shop: 0, funding: 0 };
  idle.queues.lessons = { unmarked: 0, today: 0 };
  render(<AdminIndexPage dashboard={idle} shopQueues={{ pendingProducts: 0, awaitingShipment: { studio: 0, preorder: 0, artist: 0 } }} />);
  expect(screen.getByText('지금 처리할 일이 없어요.')).toBeInTheDocument();
  expect(screen.getByText('기다리는 작업이 없어요.')).toBeInTheDocument();
});

it('현황 로딩이 실패하면 오류를 알리되 메뉴와 수익 카드는 남는다', async () => {
  (loadAdminDashboard as jest.Mock).mockRejectedValue(new Error('db down'));
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as { props: React.ComponentProps<typeof AdminIndexPage> };
  expect(result.props.dashboard).toBeNull();
  expect(result.props.error).toMatch(/불러오지 못했습니다/);

  render(<AdminIndexPage {...result.props} />);
  expect(screen.getByText(/불러오지 못했습니다/)).toBeInTheDocument();
  // 구역 링크는 묶음(드롭다운) 안에 있다 — 열면 닿는다.
  fireEvent.click(screen.getByRole('button', { name: '연습실' }));
  expect(screen.getByRole('link', { name: '구독' })).toHaveAttribute('href', '/admin/subscriptions');
  expect(screen.queryByText('처리할 일')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '10월 수익' })).toBeInTheDocument();
});

it('getServerSideProps는 상점·매출·현황을 함께 읽는다 — 매출이 현황보다 먼저 끝나기를 기다리지 않는다', async () => {
  let releaseRevenue: (value: RevenueSnapshot) => void = () => {};
  (loadRevenueSnapshot as jest.Mock).mockReturnValue(new Promise<RevenueSnapshot>((resolve) => { releaseRevenue = resolve; }));
  (loadAdminDashboard as jest.Mock).mockResolvedValue(DASHBOARD);
  const pending = getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext);
  await new Promise((r) => setTimeout(r, 0));
  // 매출이 아직 안 끝났는데 현황 조회는 이미 시작됐다.
  expect(loadAdminDashboard).toHaveBeenCalledTimes(1);
  releaseRevenue(REVENUE);
  const result = (await pending) as { props: React.ComponentProps<typeof AdminIndexPage> };
  expect(result.props.dashboard).toEqual(DASHBOARD);
  expect(result.props.revenue).toEqual(REVENUE);
});

describe('이번 달 수익', () => {
  it('수익을 크게, 매출·지출·전월 대비와 분야별 수익을 그리고 재무로 잇는다', () => {
    render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} revenue={REVENUE} />);
    expect(screen.getByRole('heading', { name: '10월 수익' })).toBeInTheDocument();
    // 큰 숫자는 링크가 아니다 — 재무로 가는 링크는 제목 옆 하나뿐.
    expect(screen.getByText('1,000,000원').closest('a')).toBeNull();
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/admin/finance')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '10월 매출·지출·수익 자세히 보기' })).toHaveAttribute('href', '/admin/finance');
    expect(screen.getByText('매출 (환불 제외)').closest('div')).toHaveTextContent('1,250,000원');
    expect(screen.getByText('지출').closest('div')).toHaveTextContent('-250,000원');
    expect(screen.getByText(/25\.0% 전월\(1,000,000원\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /연습실\s*300,000원/ })).toHaveAttribute('href', '/admin/finance?line=practice');
    expect(screen.getByRole('link', { name: /^플랫폼/ })).toHaveAttribute('href', '/admin/finance?line=platform');
  });

  it('수익이 마이너스면 빨갛게, 지출 표가 없으면 매출만 보이고, 빠진 표는 알린다', () => {
    const { rerender } = render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} revenue={{ ...REVENUE, totalProfit: -120_000 }} />);
    expect(screen.getByText('-120,000원')).toHaveClass('text-red-700');
    rerender(
      <AdminIndexPage
        dashboard={DASHBOARD}
        shopQueues={SHOP_QUEUES}
        revenue={{ ...REVENUE, totalProfit: null, expenseTotal: null, changeRate: null, previousNet: 0, manualMissing: true, lessonMissing: true }}
      />,
    );
    expect(screen.getByText(/지출 표를 읽지 못해 수익을 낼 수 없어요/)).toBeInTheDocument();
    expect(screen.getByText(/전월 매출이 없어/)).toBeInTheDocument();
    expect(screen.getByText(/직접 받은 매출\(0063\) · 레슨 수납\(0081\) 표를 읽지 못해/)).toBeInTheDocument();
  });

  it('매출 조회가 실패해도 첫 화면은 그대로 뜬다 — 카드만 빠진다', async () => {
    (loadRevenueSnapshot as jest.Mock).mockRejectedValue(new Error('db down'));
    (loadAdminDashboard as jest.Mock).mockResolvedValue(DASHBOARD);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = (await getServerSideProps({ query: {} } as unknown as GetServerSidePropsContext)) as { props: React.ComponentProps<typeof AdminIndexPage> };
    expect(result.props.revenue).toBeNull();
    render(<AdminIndexPage {...result.props} />);
    expect(screen.queryByText(/월 수익/)).not.toBeInTheDocument();
    expect(screen.getByText('처리할 일')).toBeInTheDocument();
  });
});

describe('놓치기 쉬운 대기열 — 마감 뒤 정산 기록, 계좌 입금 대기', () => {
  it('정산 기록·이체 대기와 종류별 입금 대기를 건수·이동 링크와 함께 그린다', () => {
    render(<AdminIndexPage dashboard={DASHBOARD} shopQueues={SHOP_QUEUES} />);

    expect(screen.getByRole('link', { name: /정산 기록 대기 펀딩 \(마감됨\)\s*1/ })).toHaveAttribute('href', '/admin/funding/projects?payout=record');
    expect(screen.getByRole('link', { name: /이체 대기 펀딩 정산\s*2/ })).toHaveAttribute('href', '/admin/funding/projects?payout=pending');
    expect(screen.getByRole('link', { name: /환불 요청 펀딩 후원\s*1/ })).toHaveAttribute('href', '/admin/funding');
    expect(screen.getByRole('link', { name: /입금 대기 예약·믹싱\s*3/ })).toHaveAttribute('href', '/admin/bookings?deposit=pending');
    expect(screen.getByRole('link', { name: /입금 대기 펀딩\s*2/ })).toHaveAttribute('href', '/admin/funding?deposit=pending');
    expect(screen.getByRole('link', { name: /입금 대기 상점 주문\s*1/ })).toHaveAttribute('href', '/admin/shop');
    expect(screen.getByRole('link', { name: /정산 기록 대기 상점 \(지난 달\)\s*2/ })).toHaveAttribute('href', '/admin/shop');
    expect(screen.getByRole('link', { name: /이체 대기 상점 정산\s*1/ })).toHaveAttribute('href', '/admin/shop');
    expect(screen.getByRole('link', { name: /정산 기록 대기 공연 \(종료됨\)\s*3/ })).toHaveAttribute('href', '/admin/shows');
    expect(screen.getByRole('link', { name: /이체 대기 공연 정산\s*2/ })).toHaveAttribute('href', '/admin/shows');
    // 점검 메일의 "입금 안내 기한" 항목이 여러 종류일 때 오는 자리.
    expect(document.getElementById('deposits')).not.toBeNull();
  });
});
