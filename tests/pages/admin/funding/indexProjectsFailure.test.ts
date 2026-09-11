/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../../lib/funding/projects', () => ({ getAllFundingProjects: jest.fn() }));
jest.mock('../../../../lib/funding/admin-list', () => ({ listFundingOrders: jest.fn(), aggregateAdminFundingTotals: jest.fn() }));
jest.mock('../../../../lib/funding/service', () => ({ expireStalePledges: jest.fn() }));

import type { GetServerSidePropsContext } from 'next';
import { getServerSideProps } from '../../../../pages/admin/funding/index';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { getAllFundingProjects } from '../../../../lib/funding/projects';
import { aggregateAdminFundingTotals, listFundingOrders } from '../../../../lib/funding/admin-list';

const context = { query: {} } as unknown as GetServerSidePropsContext;

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
  (listFundingOrders as jest.Mock).mockResolvedValue([]);
  (aggregateAdminFundingTotals as jest.Mock).mockResolvedValue({
    confirmedAmount: 0, confirmedCount: 0, confirmedPersonCount: 0, pendingAmount: 0, pendingCount: 0,
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// md 한 편의 frontmatter가 깨지면 예전엔 관리자 화면 전체가 500이었다 — 후원 목록은
// md와 무관하게 DB에서 오므로 목록까지 함께 죽을 이유가 없다.
it('md 파싱이 실패해도 500이 아니라 빈 프로젝트 목록 + 에러 배너', async () => {
  (getAllFundingProjects as jest.Mock).mockImplementation(() => { throw new Error('frontmatter: title 누락'); });
  const result = (await getServerSideProps(context)) as { props: { projects: unknown[]; error?: string; pledgesError?: string } };
  expect(result.props.projects).toEqual([]);
  expect(result.props.error).toContain('펀딩 프로젝트 파일을 읽지 못했습니다');
  // 목록 조회는 멀쩡했다 — pledgesError가 없어야 화면이 표를 그린다.
  expect(result.props.pledgesError).toBeUndefined();
});

it('후원 목록 조회가 실패했을 때만 pledgesError가 붙는다', async () => {
  (getAllFundingProjects as jest.Mock).mockReturnValue([]);
  (listFundingOrders as jest.Mock).mockRejectedValueOnce(new Error('db down'));
  const result = (await getServerSideProps(context)) as { props: { pledgesError?: string } };
  expect(result.props.pledgesError).toContain('후원 목록을 불러오는 중 오류');
});

it('정상일 때는 에러 없이 프로젝트를 내려준다', async () => {
  (getAllFundingProjects as jest.Mock).mockReturnValue([{ slug: 'demo', title: '데모', rewards: [] }]);
  const result = (await getServerSideProps(context)) as { props: { projects: unknown[]; error?: string } };
  expect(result.props.projects).toHaveLength(1);
  expect(result.props.error).toBeUndefined();
});
