/**
 * @jest-environment node
 *
 * funding SSR 형제 테스트 전부가 node 환경을 쓰는 관례를 따른다 — jsdom은
 * iron-session이 의존하는 uncrypto를 ESM(.mjs)으로 풀어 파싱이 깨진다
 * (lib/funding/creatorAuth.test.ts와 같은 사유 — 이 페이지가 creatorAuth를 임포트한다).
 */
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/[locale]/funding/creator/[id]';
// eslint-disable-next-line import/first
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { loadProjectForCreator, type CreatorProjectDetail } from '../../../../lib/funding/creatorProjectWrite';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

const PROJECT: CreatorProjectDetail = {
  id: 'proj-1',
  slug: 'my-project',
  title: '제목',
  summary: '요약',
  content: '본문',
  coverUrl: '/api/funding/media/cover.webp?w=1&h=1',
  goalAmount: 1_000_000,
  startAt: new Date('2026-10-01T00:00:00Z'),
  endAt: new Date('2026-11-01T00:00:00Z'),
  reviewStatus: 'draft',
  status: 'draft',
  reviewNote: null,
  creator: {
    name: '개설자',
    contactName: '담당자',
    phone: '010-0000-0000',
    bio: '소개',
    links: ['https://example.com'],
  },
  rewards: [],
};

describe('funding creator 편집 화면 getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // funding의 다른 SSR 형제 페이지(creator/index·auth)와 같은 자리, 같은 방식 — 세션 쿠키가
  // path=/라 로케일을 가리지 않으므로, 이 가드가 없으면 /en/funding/creator/<id>가 인증
  // 검사를 그대로 통과해 같은 화면이 7개 URL로 존재하게 된다. 인증 검사보다 먼저 걸려야
  // 하므로 세션·DB 목이 호출되지 않아도 이 리다이렉트가 나와야 한다.
  it('비-ko locale → /ko/funding/creator/<id>로 redirect (인증 검사보다 먼저)', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'en', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect(result).toEqual({ redirect: { destination: '/ko/funding/creator/proj-1', permanent: false } });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(authenticateCreatorRequest).not.toHaveBeenCalled();
  });

  it('세션 없음 → /ko/funding/apply로 redirect', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: false });
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect(result).toEqual({ redirect: { destination: '/ko/funding/apply', permanent: false } });
    expect(loadProjectForCreator).not.toHaveBeenCalled();
  });

  it('남의 프로젝트(또는 없는 프로젝트) → notFound', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
    (loadProjectForCreator as jest.Mock).mockResolvedValue(null);
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect(result).toEqual({ notFound: true });
    expect(loadProjectForCreator).toHaveBeenCalledWith('creator-a', 'proj-1');
  });

  it('본인 프로젝트 → props에 담고, 개설자 비공개 필드(taxType·payoutAccount)는 없다', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
    (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect('props' in (result as object)).toBe(true);
    const props = (result as unknown as { props: { project: Record<string, unknown> } }).props;
    expect(props.project.id).toBe('proj-1');
    expect(props.project.slug).toBe('my-project');
    // 날짜는 __NEXT_DATA__ 직렬화를 위해 ISO 문자열이어야 한다.
    expect(props.project.startAt).toBe('2026-10-01T00:00:00.000Z');

    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain('taxType');
    expect(serialized).not.toContain('payoutAccount');
    expect(serialized).not.toContain('payoutBankName');
    expect(serialized).not.toContain('payoutHolder');

    const creator = props.project.creator as Record<string, unknown>;
    expect(Object.keys(creator).sort()).toEqual(['bio', 'contactName', 'links', 'name', 'phone'].sort());
  });

  it('리워드는 lockedAt 대신 locked 불리언만 담는다', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
    (loadProjectForCreator as jest.Mock).mockResolvedValue({
      ...PROJECT,
      rewards: [{
        id: 'r1', projectId: 'proj-1', rewardId: 'basic', title: '리워드', description: '설명',
        amount: 10_000, totalQuantity: null, requiresShipping: false, estimatedDelivery: '2026년 12월',
        imageUrl: null, downloads: null, sortOrder: 0,
        lockedAt: new Date('2026-09-01T00:00:00Z'),
        createdAt: new Date(), updatedAt: new Date(),
      }],
    });
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    const props = (result as unknown as { props: { project: { rewards: Array<Record<string, unknown>> } } }).props;
    expect(props.project.rewards).toEqual([{
      rewardId: 'basic', title: '리워드', description: '설명', amount: 10_000,
      totalQuantity: null, requiresShipping: false, estimatedDelivery: '2026년 12월',
      imageUrl: null, locked: true,
    }]);
  });
});
