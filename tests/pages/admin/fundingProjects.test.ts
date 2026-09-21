/** @jest-environment node */
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../lib/funding/adminProjects', () => ({
  listProjectsForAdmin: jest.fn(),
  loadProjectForAdmin: jest.fn(),
}));

import type { GetServerSidePropsContext } from 'next';
import { getServerSideProps as getListProps } from '../../../pages/admin/funding/projects/index';
import { getServerSideProps as getDetailProps } from '../../../pages/admin/funding/projects/[id]';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { listProjectsForAdmin, loadProjectForAdmin, type AdminProjectDetail } from '../../../lib/funding/adminProjects';

const listContext = { query: {} } as unknown as GetServerSidePropsContext;
const detailContext = (id: unknown) => ({ query: { id } }) as unknown as GetServerSidePropsContext;

beforeEach(() => {
  jest.clearAllMocks();
});

const baseDetail: AdminProjectDetail = {
  id: 'proj-1',
  slug: 'demo-project',
  title: '데모 프로젝트',
  reviewStatus: 'submitted',
  status: 'draft',
  hidden: false,
  submittedAt: '2026-09-10T00:00:00.000Z',
  approvedAt: null,
  creatorName: '홍길동',
  creatorEmail: 'creator@example.com',
  goalAmount: 1_000_000,
  startAt: '2026-09-20T00:00:00.000Z',
  endAt: '2026-10-20T00:00:00.000Z',
  summary: '요약',
  content: '본문',
  coverUrl: '/images/cover.jpg',
  reviewNote: null,
  internalNote: null,
  creatorTermsVersion: 'funding-creator-terms-2026-09-18',
  creatorEditedAt: null,
  creator: { contactName: '담당자', phone: '010-0000-0000', bio: null, links: null },
  rewards: [
    {
      rewardId: 'r1',
      title: '리워드 1',
      description: '설명',
      amount: 30_000,
      totalQuantity: 100,
      requiresShipping: true,
      estimatedDelivery: '2026-11-01',
      imageUrl: null,
      sortOrder: 0,
      lockedAt: null,
    },
    {
      rewardId: 'r2',
      title: '리워드 2 (잠김)',
      description: '설명2',
      amount: 50_000,
      totalQuantity: null,
      requiresShipping: false,
      estimatedDelivery: '2026-11-05',
      imageUrl: null,
      sortOrder: 1,
      lockedAt: new Date('2026-09-15T00:00:00.000Z'),
    },
  ],
};

describe('심사 목록 getServerSideProps', () => {
  it('인증 실패 → /admin/login 리다이렉트', async () => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: false });
    const result = await getListProps(listContext);
    expect(result).toEqual({ redirect: { destination: '/admin/login', permanent: false } });
    expect(listProjectsForAdmin).not.toHaveBeenCalled();
  });

  it('심사대기 → 보완요청 → 나머지 순으로 정렬한다', async () => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
    (listProjectsForAdmin as jest.Mock).mockResolvedValue([
      { id: 'a', reviewStatus: 'approved', title: 'A' },
      { id: 'b', reviewStatus: 'submitted', title: 'B' },
      { id: 'c', reviewStatus: 'changes_requested', title: 'C' },
      { id: 'd', reviewStatus: 'draft', title: 'D' },
    ]);
    const result = (await getListProps(listContext)) as { props: { projects: { id: string }[] } };
    expect(result.props.projects.map((p) => p.id)).toEqual(['b', 'c', 'd', 'a']);
  });
});

describe('심사 상세 getServerSideProps', () => {
  it('인증 실패 → /admin/login 리다이렉트', async () => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: false });
    const result = await getDetailProps(detailContext('proj-1'));
    expect(result).toEqual({ redirect: { destination: '/admin/login', permanent: false } });
    expect(loadProjectForAdmin).not.toHaveBeenCalled();
  });

  it('id가 문자열이 아니면 notFound', async () => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
    const result = await getDetailProps(detailContext(undefined));
    expect(result).toEqual({ notFound: true });
    expect(loadProjectForAdmin).not.toHaveBeenCalled();
  });

  it('없는 id → notFound', async () => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
    (loadProjectForAdmin as jest.Mock).mockResolvedValue(null);
    const result = await getDetailProps(detailContext('no-such-id'));
    expect(result).toEqual({ notFound: true });
  });

  it('props는 화이트리스트된 필드만 담고, 정산 관련 필드가 없다', async () => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
    (loadProjectForAdmin as jest.Mock).mockResolvedValue(baseDetail);
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as {
      props: { project: Record<string, unknown> };
    };
    const { project } = result.props;

    expect(Object.keys(project).sort()).toEqual(
      [
        'id', 'slug', 'title', 'reviewStatus', 'status', 'hidden', 'submittedAt', 'approvedAt',
        'creatorName', 'creatorEmail', 'goalAmount', 'startAt', 'endAt', 'summary', 'content',
        'coverUrl', 'reviewNote', 'internalNote', 'creatorEditedAt', 'creator', 'rewards',
      ].sort(),
    );

    // 정산·정산은 별도 테이블(fundingProjectPayouts)이라 이 화면 props에는 애초에
    // 들어올 수 없어야 한다 — 이름으로 한 번 더 못을 박아 회귀를 잡는다.
    const projectJson = JSON.stringify(project).toLowerCase();
    expect(projectJson).not.toContain('payout');
    expect(projectJson).not.toContain('settlement');
    expect(projectJson).not.toContain('withholding');
    expect(projectJson).not.toContain('supplyamount');

    // lockedAt(Date)은 그대로 못 내려간다 — locked(boolean)로 좁혀졌는지 확인.
    expect(project.rewards).toEqual([
      expect.objectContaining({ rewardId: 'r1', locked: false }),
      expect.objectContaining({ rewardId: 'r2', locked: true }),
    ]);
    for (const reward of project.rewards as Record<string, unknown>[]) {
      expect(reward.lockedAt).toBeUndefined();
    }
  });

  // 최상위 화이트리스트만 보면 creator 서브객체가 조용히 넓어질 수 있다 — bio·links는
  // 화면 어디에도 렌더하지 않으므로 애초에 담지 않는다(안 쓰는 개인정보를 클라이언트로
  // 내보낼 이유가 없다).
  it('creator 서브객체도 contactName·phone만 담고 bio·links는 없다', async () => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
    (loadProjectForAdmin as jest.Mock).mockResolvedValue({
      ...baseDetail,
      creator: { contactName: '담당자', phone: '010-0000-0000', bio: '자기소개 원문', links: ['https://x.com'] },
    });
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as {
      props: { project: { creator: Record<string, unknown> } };
    };
    expect(Object.keys(result.props.project.creator).sort()).toEqual(['contactName', 'phone']);
  });
});
