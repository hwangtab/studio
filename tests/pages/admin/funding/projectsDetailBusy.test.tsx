import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockReplace = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ replace: mockReplace, asPath: '/admin/funding/projects/proj-1', pathname: '/admin/funding/projects/[id]' }),
}));
jest.mock('../../../../components/admin/fundingProjectActions', () => ({ patchFundingProject: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminFundingProjectDetailPage from '../../../../pages/admin/funding/projects/[id]';
import { patchFundingProject } from '../../../../components/admin/fundingProjectActions';

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const PROJECT = {
  id: 'proj-1', slug: 'demo', title: '데모', reviewStatus: 'submitted' as const, status: 'draft', hidden: false,
  submittedAt: '2026-09-10T00:00:00.000Z', approvedAt: null, creatorName: '홍길동', creatorEmail: 'c@x.y',
  goalAmount: 1_000_000, startAt: '2026-09-20T00:00:00.000Z', endAt: '2026-10-20T00:00:00.000Z', summary: '요약', content: '본문',
  coverUrl: '/images/cover.jpg', reviewNote: null, internalNote: null, creatorEditedAt: null,
  creator: { id: 'creator-1', contactName: '담당자', phone: '010-0000-0000' },
  rewards: [],
};

// 갱신(router.replace)이 끝나기 전에 버튼이 풀리면, 승인 직후 한 번 더 눌러 낡은 판본으로 409가 나가
// 그 빨간 오류가 방금의 성공 안내를 덮었다.
it('판정 버튼은 화면이 새 값으로 갱신된 뒤에야 다시 눌린다', async () => {
  let finishReplace: () => void = () => {};
  mockReplace.mockReturnValue(new Promise<void>((resolve) => { finishReplace = resolve; }));
  (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true });
  window.confirm = jest.fn().mockReturnValue(true);
  render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={{ available: true, service: null }} />);

  fireEvent.click(screen.getByRole('button', { name: '승인' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());

  expect(screen.getByRole('button', { name: '승인' })).toBeDisabled();

  await act(async () => finishReplace());
  await waitFor(() => expect(screen.getByRole('button', { name: '승인' })).toBeEnabled());
});
