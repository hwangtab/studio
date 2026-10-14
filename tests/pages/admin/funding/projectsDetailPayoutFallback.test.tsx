import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    asPath: '/admin/funding/projects/proj-1',
    pathname: '/admin/funding/projects/[id]',
  }),
}));
jest.mock('../../../../components/admin/fundingProjectActions', () => ({ patchFundingProject: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminFundingProjectDetailPage from '../../../../pages/admin/funding/projects/[id]';
import { patchFundingProject } from '../../../../components/admin/fundingProjectActions';

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const PROJECT = {
  id: 'proj-1', slug: 'demo-project', title: '데모 프로젝트', reviewStatus: 'approved' as const, status: 'closed', hidden: false,
  submittedAt: '2026-09-10T00:00:00.000Z', approvedAt: '2026-09-11T00:00:00.000Z', creatorName: '홍길동', creatorEmail: 'creator@example.com',
  goalAmount: 1_000_000, startAt: '2026-09-20T00:00:00.000Z', endAt: '2026-10-20T00:00:00.000Z', summary: '요약', content: '본문',
  coverUrl: '/images/cover.jpg', reviewNote: null, internalNote: null, creatorEditedAt: null,
  creator: { id: 'creator-1', contactName: '담당자', phone: '010-0000-0000' },
  rewards: [],
};
const SERVICE = { available: true as const, service: null };

beforeEach(() => {
  (patchFundingProject as jest.Mock).mockReset().mockResolvedValue({ ok: true });
  window.confirm = jest.fn().mockReturnValue(true);
  window.prompt = jest.fn().mockReturnValue('10/14 이체');
});

// 집계가 죽으면(payout=null) 지급 완료 버튼까지 사라져, 이체를 끝내고도 기록할 수 없었다.
it('정산 집계가 실패해도 이체 대기 정산이 기록돼 있으면 지급 완료로 표시할 수 있다', async () => {
  render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} pendingPayoutFallback={{ netAmount: 1_234_000 }} service={SERVICE} />);

  expect(screen.getByText(/이체 대기 정산이 기록되어 있습니다/)).toBeInTheDocument();
  expect(screen.getByText(/1,234,000원/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '지급 완료로 표시' }));

  await waitFor(() => expect(patchFundingProject).toHaveBeenCalledWith('proj-1', { action: 'mark_payout_paid', memo: '10/14 이체' }));
});

it('기록된 이체 대기 정산이 없으면 그 안내를 띄우지 않는다', () => {
  render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} pendingPayoutFallback={null} service={SERVICE} />);
  expect(screen.queryByText(/이체 대기 정산이 기록되어 있습니다/)).not.toBeInTheDocument();
});
