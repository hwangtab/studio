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
    <AdminFundingPage items={[]} truncated={false} projects={[]} slug={null} pledgesError="후원 목록을 불러오는 중 오류가 발생했습니다." />,
  );
  expect(screen.getByRole('heading', { name: '오류' })).toBeInTheDocument();
});

// 부분환불 건도 후원은 살아 있다 — 공개 현황판(aggregateProjectStatus)과 같은 집합이어야 한다.
it('확정 금액·후원자 수는 partially_refunded도 센다', () => {
  render(
    <AdminFundingPage
      items={[item(), item({ id: 'o2', orderNo: 'FND-20261015-BBBB2222', status: 'partially_refunded' })]}
      truncated={false}
      projects={[]}
      slug={null}
    />,
  );
  expect(screen.getByText('10,000원')).toBeInTheDocument();
  expect(screen.getByText('2명')).toBeInTheDocument();
});
