/** @jest-environment node */
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../lib/funding/adminProjects', () => ({
  listProjectsForAdmin: jest.fn(),
  loadProjectForAdmin: jest.fn(),
}));
jest.mock('../../../lib/funding/payout', () => ({ buildFundingPayoutPreview: jest.fn() }));

import type { GetServerSidePropsContext } from 'next';
import { getServerSideProps as getListProps } from '../../../pages/admin/funding/projects/index';
import { getServerSideProps as getDetailProps } from '../../../pages/admin/funding/projects/[id]';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { listProjectsForAdmin, loadProjectForAdmin, type AdminProjectDetail } from '../../../lib/funding/adminProjects';
import { buildFundingPayoutPreview } from '../../../lib/funding/payout';

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

/**
 * 정산 미리보기는 계좌·세금 처리 구분을 들고 있다. 그것을 props로 내려보내면 Pages Router가
 * `__NEXT_DATA__` JSON으로 페이지 HTML에 실어 계좌 정보가 소스에 박힌다 —
 * `lib/funding/adminProjects.integration.test.ts`의 "비공개 정산 필드는 싣지 않는다"와 같은
 * 것을 화면 쪽 경계에서 한 번 더 고정한다. 계좌는 별도 라우트
 * (`/api/admin/funding/projects/[id]/payout-account`)로만 나간다.
 */
describe('심사 상세 getServerSideProps — 정산', () => {
  const PREVIEW = {
    projectId: 'proj-1',
    projectSlug: 'demo-project',
    projectTitle: '데모 프로젝트',
    taxType: 'withholding' as const,
    manualGrossAmount: 0,
    backerCount: 12,
    closed: true,
    hasPayoutAccount: true,
    hasResidentNumber: true,
    grossAmount: 1_000_000,
    refundAmount: 0,
    supplyAmount: 909_091,
    feeAmount: 89_000,
    platformFeeAmount: 55_000,
    paymentFeeAmount: 34_000,
    shareAmount: 911_000,
    withholdingAmount: 30_063,
    netAmount: 880_937,
    recorded: null,
  };

  beforeEach(() => {
    (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true });
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue(PREVIEW);
  });

  it('승인 전 프로젝트는 정산을 계산하지 않는다', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue(baseDetail);
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as { props: { payout: unknown } };
    expect(result.props.payout).toBeNull();
    expect(buildFundingPayoutPreview).not.toHaveBeenCalled();
  });

  it('승인된 프로젝트의 정산 props에 계좌·세금 처리 구분이 없다', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue({ ...baseDetail, reviewStatus: 'approved' });
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as {
      props: { payout: Record<string, unknown> };
    };
    const { payout } = result.props;

    expect(Object.keys(payout).sort()).toEqual(
      [
        'grossAmount', 'refundAmount', 'manualGrossAmount', 'supplyAmount',
        'platformFeeAmount', 'paymentFeeAmount', 'feeAmount', 'shareAmount',
        'withholdingAmount', 'netAmount', 'backerCount', 'closed',
        'hasPayoutAccount', 'hasTaxType', 'needsResidentNumber', 'recorded',
      ].sort(),
    );
    expect(payout.netAmount).toBe(880_937);
    // 주민등록번호는 등록 여부조차 아니고 **게이트 판정 하나**만 내려간다.
    expect(payout.needsResidentNumber).toBe(false);

    const serialized = JSON.stringify(result.props);
    expect(serialized).not.toContain('taxType');
    expect(serialized).not.toContain('withholding\"');
    expect(serialized).not.toContain('payoutBankName');
    expect(serialized).not.toContain('payoutAccount');
    expect(serialized).not.toContain('payoutHolder');
    expect(serialized).not.toContain('residentNumberEnc');
    expect(serialized).not.toContain('hasResidentNumber');
  });

  it('원천징수 대상인데 주민등록번호가 없으면 게이트 판정만 true로 내려간다', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue({ ...baseDetail, reviewStatus: 'approved' });
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue({ ...PREVIEW, hasResidentNumber: false });
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as {
      props: { payout: Record<string, unknown> };
    };
    expect(result.props.payout.needsResidentNumber).toBe(true);
  });

  it('사업자는 주민등록번호가 없어도 게이트에 걸리지 않는다', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue({ ...baseDetail, reviewStatus: 'approved' });
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue({
      ...PREVIEW, taxType: 'invoice' as const, hasResidentNumber: false,
    });
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as {
      props: { payout: Record<string, unknown> };
    };
    expect(result.props.payout.needsResidentNumber).toBe(false);
  });

  it('기록된 정산의 Date는 ISO 문자열로 좁혀진다', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue({ ...baseDetail, reviewStatus: 'approved' });
    (buildFundingPayoutPreview as jest.Mock).mockResolvedValue({
      ...PREVIEW,
      recorded: {
        id: 'pay-1',
        projectId: 'proj-1',
        grossAmount: 1_000_000,
        refundAmount: 0,
        supplyAmount: 909_091,
        feeAmount: 89_000,
        platformFeeAmount: 55_000,
        paymentFeeAmount: 34_000,
        shareAmount: 911_000,
        withholdingAmount: 30_063,
        netAmount: 880_937,
        backerCount: 12,
        status: 'paid',
        paidAt: new Date('2026-11-05T00:00:00.000Z'),
        memo: null,
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        updatedAt: new Date('2026-11-05T00:00:00.000Z'),
      },
    });
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as {
      props: { payout: { recorded: Record<string, unknown> } };
    };
    expect(result.props.payout.recorded.paidAt).toBe('2026-11-05T00:00:00.000Z');
    expect(result.props.payout.recorded.createdAt).toBe('2026-11-01T00:00:00.000Z');
    // projectId·updatedAt은 화면이 쓰지 않으므로 담지 않는다.
    expect(result.props.payout.recorded.updatedAt).toBeUndefined();
  });

  it('정산 집계가 실패해도 심사 화면은 열린다', async () => {
    (loadProjectForAdmin as jest.Mock).mockResolvedValue({ ...baseDetail, reviewStatus: 'approved' });
    (buildFundingPayoutPreview as jest.Mock).mockRejectedValue(new Error('DB 장애'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = (await getDetailProps(detailContext('proj-1'))) as unknown as {
      props: { payout: unknown; project: { id: string } };
    };
    expect(result.props.payout).toBeNull();
    expect(result.props.project.id).toBe('proj-1');
    jest.restoreAllMocks();
  });
});
