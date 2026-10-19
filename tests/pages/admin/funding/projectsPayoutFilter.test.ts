/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../../lib/funding/adminProjects', () => ({ listProjectsForAdmin: jest.fn() }));
jest.mock('../../../../lib/funding/projectServices', () => ({
  loadProjectServiceMap: jest.fn().mockResolvedValue({ available: true, byProjectId: {} }),
  PROJECT_SERVICE_LABELS: {},
}));
jest.mock('../../../../lib/funding/payout', () => ({
  listPendingFundingPayoutProjectIds: jest.fn(),
  listFundingProjectsAwaitingPayoutRecord: jest.fn(),
}));

import { getServerSideProps } from '../../../../pages/admin/funding/projects/index';
import { listProjectsForAdmin } from '../../../../lib/funding/adminProjects';
import { listFundingProjectsAwaitingPayoutRecord, listPendingFundingPayoutProjectIds } from '../../../../lib/funding/payout';

const project = (id: string) => ({ id, title: id, reviewStatus: 'approved', creatorName: 'x', creatorEmail: 'x@y.z', submittedAt: null, goalAmount: 1 });
type Result = { props: { projects: Array<{ id: string }>; payoutFilter?: string } };

beforeEach(() => {
  jest.clearAllMocks();
  (listProjectsForAdmin as jest.Mock).mockResolvedValue([project('a'), project('b'), project('c')]);
  (listPendingFundingPayoutProjectIds as jest.Mock).mockResolvedValue(['b']);
  (listFundingProjectsAwaitingPayoutRecord as jest.Mock).mockResolvedValue([{ id: 'c' }]);
});

it('?payout=pending이면 이체 대기 정산이 있는 프로젝트만 싣는다', async () => {
  const r = (await getServerSideProps({ query: { payout: 'pending' } } as never)) as Result;
  expect(r.props.projects.map((p) => p.id)).toEqual(['b']);
  expect(r.props.payoutFilter).toBe('pending');
});

it('?payout=record이면 마감됐는데 정산이 기록되지 않은 프로젝트만 싣는다', async () => {
  const r = (await getServerSideProps({ query: { payout: 'record' } } as never)) as Result;
  expect(r.props.projects.map((p) => p.id)).toEqual(['c']);
  expect(r.props.payoutFilter).toBe('record');
});

it('필터가 없으면 전부 싣고 정산 조회도 하지 않는다', async () => {
  const r = (await getServerSideProps({ query: {} } as never)) as Result;
  expect(r.props.projects).toHaveLength(3);
  expect(r.props.payoutFilter).toBeUndefined();
  expect(listPendingFundingPayoutProjectIds).not.toHaveBeenCalled();
  expect(listFundingProjectsAwaitingPayoutRecord).not.toHaveBeenCalled();
});
