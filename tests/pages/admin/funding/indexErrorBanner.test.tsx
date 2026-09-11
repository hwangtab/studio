import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/funding' }) }));
// admin-auth·DB는 ESM(iron-session·uncrypto)을 끌고 들어온다 — getServerSideProps는 이 테스트 대상이 아니다.
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../../lib/funding/admin-list', () => ({ listFundingOrders: jest.fn() }));
jest.mock('../../../../lib/funding/service', () => ({ expireStalePledges: jest.fn() }));
jest.mock('../../../../components/admin/fundingActions', () => ({ createManualPledge: jest.fn() }));

// eslint-disable-next-line import/first
import AdminFundingPage from '../../../../pages/admin/funding/index';
// eslint-disable-next-line import/first
import type { AdminPledgeItem } from '../../../../lib/funding/admin-serialize';
// eslint-disable-next-line import/first
import type { AdminFundingTotals } from '../../../../lib/funding/admin-list';

const TOTALS: AdminFundingTotals = {
  confirmedAmount: 0, confirmedCount: 0, confirmedPersonCount: 0, pendingAmount: 0, pendingCount: 0,
};

const item = (over: Partial<AdminPledgeItem> = {}): AdminPledgeItem => ({
  id: 'o1', orderNo: 'FND-20261015-AAAA1111', status: 'paid', paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@b.com',
  rewardTitle: '감사 메일', quantity: 1, totalAmount: 5000, additionalAmount: 0,
  fulfillmentStatus: 'none', createdAt: new Date('2026-10-15T03:00:00Z').toISOString(),
  ...over,
} as AdminPledgeItem);

// md 파싱 실패는 표와 무관한 사고다 — 예전엔 이 하나로 전체 화면이 오류 카드로 바뀌어
// 멀쩡히 조회된 후원 목록을 관리자가 못 봤다.
it('projects 로더 에러는 배너로만 뜨고 후원 표는 그대로 렌더된다', () => {
  render(
    <AdminFundingPage
      items={[item()]}
      totals={TOTALS}
      truncated={false}
      projects={[]}
      slug={null}
      error="펀딩 프로젝트 파일을 읽지 못했습니다. 수기 등록은 사용할 수 없습니다."
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('펀딩 프로젝트 파일을 읽지 못했습니다');
  expect(screen.getByText('FND-20261015-AAAA1111')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '오류' })).not.toBeInTheDocument();
});

it('후원 목록 조회 자체가 실패하면 전체 화면 오류', () => {
  render(
    <AdminFundingPage items={[]} totals={TOTALS} truncated={false} projects={[]} slug={null} pledgesError="후원 목록을 불러오는 중 오류가 발생했습니다." />,
  );
  expect(screen.getByRole('heading', { name: '오류' })).toBeInTheDocument();
});

/**
 * 상단 KPI는 **목록에서 계산하지 않는다.** 예전엔 items(최대 200건)를 JS에서 합산해서,
 * 201건째부터 관리자 수치가 공개 진행률과 조용히 갈라졌다. 화면에 실린 2건과 전혀 다른
 * totals를 넘겨 그 결합이 끊겼는지 확인한다.
 */
it('KPI는 화면에 그려진 목록이 아니라 서버 집계(totals)를 그린다', () => {
  render(
    <AdminFundingPage
      items={[item(), item({ id: 'o2', orderNo: 'FND-20261015-BBBB2222', status: 'partially_refunded' })]}
      totals={{
        confirmedAmount: 12_345_000, confirmedCount: 412, confirmedPersonCount: 380,
        pendingAmount: 60_000, pendingCount: 3,
      }}
      truncated
      projects={[]}
      slug={null}
    />,
  );
  expect(screen.getByText('12,345,000원')).toBeInTheDocument();
  // 건수와 인원을 따로 그린다 — COUNT(*)를 '명'으로 적던 것이 이 화면의 원래 문제였다.
  expect(screen.getByText('412건')).toBeInTheDocument();
  expect(screen.getByText('380명')).toBeInTheDocument();
  expect(screen.getByText('60,000원')).toBeInTheDocument();
  // 목록 합계(10,000원 / 2건)는 어디에도 나오면 안 된다.
  expect(screen.queryByText('10,000원')).not.toBeInTheDocument();
  expect(screen.queryByText('2명')).not.toBeInTheDocument();
});

// truncated 안내는 목록에만 걸린다 — 지표까지 "최근 200건 기준"이면 고친 게 아니다.
it('truncated 배너는 목록에만 해당한다고 말한다', () => {
  render(<AdminFundingPage items={[item()]} totals={TOTALS} truncated projects={[]} slug={null} />);
  expect(screen.getByText(/전건 기준/)).toBeInTheDocument();
  expect(screen.getByText(/전건을 집계한 값입니다/)).toBeInTheDocument();
});
