/** 매출 현황 화면 — 숫자·구성·기간 이동·수기 매출 경고가 데이터대로 그려지는지. */
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/revenue', pathname: '/admin/revenue', query: {} }) }));
jest.mock('../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminRevenuePage from '../../../pages/admin/revenue';
import { summarizeRevenue, type RevenueRow } from '../../../lib/ops/revenueReport';

const row = (over: Partial<Omit<RevenueRow, 'at'>> & { at: string }): RevenueRow => ({
  orderNo: `NO-${over.at}-${over.type ?? 'session'}`, type: 'session', projectSlug: null, method: '카드',
  gross: 110000, vat: 10000, refunded: 0, offline: false, ...over, at: new Date(over.at),
});

const ROWS = [
  row({ at: '2026-10-05T03:00:00Z' }),
  row({ at: '2026-10-06T03:00:00Z', type: 'funding', projectSlug: 'rally', gross: 50000, vat: 0, refunded: 20000, method: '계좌 입금', offline: true }),
  row({ at: '2026-09-10T03:00:00Z', gross: 100000, vat: 9091 }),
];

const props = (over: Record<string, unknown> = {}) => ({
  summary: JSON.parse(JSON.stringify(summarizeRevenue(ROWS, { year: 2026, month: 10 }))),
  type: null,
  years: [2026, 2025],
  nowYear: 2026,
  nowMonth: 10,
  entryDates: ['2026.10.06', '2026.10.05'],
  today: '2026-10-16',
  manualEntries: [],
  manualError: null,
  ...over,
});

it('순매출·환불·전월 대비와 직접/중개 구성을 그린다', () => {
  render(<AdminRevenuePage {...props()} />);
  expect(screen.getByText('2026년 10월')).toBeInTheDocument();
  expect(screen.getByText('140,000원')).toBeInTheDocument(); // 순매출 = 110,000 + 30,000
  expect(screen.getAllByText('-20,000원').length).toBeGreaterThan(0); // 환불(KPI·표)
  expect(screen.getByText(/40\.0%/)).toBeInTheDocument(); // 전월 100,000 대비 +40%
  expect(screen.getByText('스튜디오 직접 서비스')).toBeInTheDocument();
  expect(screen.getByText(/판매·중개/)).toBeInTheDocument();
});

it('유형별 표의 유형 이름은 그 유형만 보는 링크이고, 기간 칩이 연·월로 이동한다', () => {
  render(<AdminRevenuePage {...props()} />);
  expect(screen.getByRole('link', { name: '펀딩 수수료' })).toHaveAttribute('href', '/admin/revenue?year=2026&month=10&type=funding');
  expect(screen.getByRole('link', { name: '2025년' })).toHaveAttribute('href', '/admin/revenue?year=2025&month=10');
  expect(screen.getByRole('link', { name: '연 전체' })).toHaveAttribute('href', '/admin/revenue?year=2026&month=all');
});

it('유형 필터가 걸리면 안내와 해제 링크를 보인다', () => {
  render(<AdminRevenuePage {...props({ summary: JSON.parse(JSON.stringify(summarizeRevenue(ROWS, { year: 2026, month: 10, type: 'funding' }))), type: 'funding' })} />);
  expect(screen.getByText(/만 보는 중/)).toHaveTextContent('펀딩');
  expect(screen.getByRole('link', { name: '전체 보기' })).toHaveAttribute('href', '/admin/revenue?year=2026&month=10');
});

it('수기 매출 표를 못 읽으면 숫자에 빠진 금액이 있다고 경고하고 폼을 닫는다', () => {
  render(<AdminRevenuePage {...props({ manualError: '직접 받은 매출 표를 읽지 못했습니다(마이그레이션 0063·0065 적용 전이거나 조회 오류).' })} />);
  expect(screen.getAllByText(/직접 받은 매출 표를 읽지 못했습니다/).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: '기록하기' })).not.toBeInTheDocument();
});

it('조회 오류면 오류 안내만 보인다', () => {
  render(<AdminRevenuePage {...props({ summary: null, error: '매출을 불러오지 못했습니다.' })} />);
  expect(screen.getByRole('alert')).toHaveTextContent('매출을 불러오지 못했습니다.');
});

it('이번 기간 수기 기록을 목록으로 보여 준다', () => {
  render(
    <AdminRevenuePage
      {...props({
        manualEntries: [{ id: 'm1', receivedOn: '2026-10-03', typeLabel: '세션 예약', description: '녹음 3시간 — 김OO', method: '현금', memo: null, totalAmount: 275000, refundedAmount: 0 }],
      })}
    />,
  );
  const item = screen.getAllByText(/녹음 3시간 — 김OO/).map((el) => el.closest('li')).find(Boolean) as HTMLElement;
  expect(within(item).getByText(/275,000원/)).toBeInTheDocument();
  expect(within(item).getByRole('button', { name: '삭제' })).toBeInTheDocument();
});

describe('연습실 손익', () => {
  const practice = (over: Record<string, unknown> = {}) => ({
    income: 3_786_000,
    incomeCount: 12,
    expense: { total: 1_060_000, byCategory: [{ category: 'rent', label: '임대료', amount: 1_000_000 }, { category: 'cleaning', label: '청소비', amount: 60_000 }] },
    studioExpenseTotal: 20_000,
    ...over,
  });

  it('월 입주 수입에서 지출을 빼 순수익을 보인다', () => {
    render(<AdminRevenuePage {...props({ practice: practice() })} />);
    expect(screen.getByRole('heading', { name: /연습실 손익/ })).toBeInTheDocument();
    expect(screen.getByText('3,786,000원')).toBeInTheDocument();
    expect(screen.getByText('− 임대료')).toBeInTheDocument();
    expect(screen.getByText('-1,060,000원')).toBeInTheDocument();
    expect(screen.getByText('2,726,000원')).toBeInTheDocument(); // 순수익
    expect(screen.getByText(/스튜디오 전체 지출 20,000원/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /지출 관리/ })).toHaveAttribute('href', '/admin/expenses');
  });

  it('지출 표를 못 읽으면 순수익을 지어내지 않고 사유를 알린다', () => {
    render(<AdminRevenuePage {...props({ practice: practice({ expense: null }), practiceNotice: '지출 표를 읽지 못했습니다(마이그레이션 0080).' })} />);
    expect(screen.getByText(/지출 표를 읽지 못했습니다/)).toBeInTheDocument();
    expect(screen.queryByText('연습실 순수익')).not.toBeInTheDocument();
  });

  it('판매·중개는 수수료만 매출로 잡는다고 안내한다', () => {
    render(<AdminRevenuePage {...props()} />);
    expect(screen.getAllByText(/플랫폼 수수료/).length).toBeGreaterThan(0);
  });
});
