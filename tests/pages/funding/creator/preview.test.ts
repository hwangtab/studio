/**
 * @jest-environment node
 *
 * funding SSR 형제 테스트 전부가 node 환경을 쓰는 관례를 따른다(tests/pages/funding/creator/edit.test.ts와
 * 같은 이유 — 이 페이지가 creatorAuth를 임포트한다).
 */
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/[locale]/funding/creator/[id]/preview';
// eslint-disable-next-line import/first
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { loadProjectForCreator, type CreatorProjectDetail } from '../../../../lib/funding/creatorProjectWrite';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

const COMPLETE_PROJECT = {
  id: 'proj-1',
  slug: 'my-project',
  title: '제목',
  summary: '요약',
  content: '# 본문\n스토리 내용입니다.',
  coverUrl: '/api/funding/media/cover.webp?w=1&h=1',
  goalAmount: 1_000_000,
  startAt: new Date('2026-10-01T00:00:00Z'),
  endAt: new Date('2026-11-01T00:00:00Z'),
  reviewStatus: 'draft',
  status: 'auto',
  reviewNote: null,
  creator: { name: '개설자', contactName: '담당자', phone: '010-0000-0000', bio: '소개', links: [] },
  rewards: [{
    id: 'r1', projectId: 'proj-1', rewardId: 'basic', title: '리워드', description: '설명',
    amount: 10_000, totalQuantity: null, requiresShipping: false, estimatedDelivery: '2026년 12월',
    imageUrl: null, downloads: null, sortOrder: 0, lockedAt: null,
    createdAt: new Date(), updatedAt: new Date(),
  }],
} as unknown as CreatorProjectDetail;

// createDraftProject가 만드는 것과 같은 모양 — 필수값이 비어 있다(title·coverUrl 빈 문자열,
// startAt===endAt, rewards 없음).
const DRAFT_PROJECT = {
  ...COMPLETE_PROJECT,
  title: '',
  summary: '',
  content: '',
  coverUrl: '',
  startAt: new Date('2026-10-01T00:00:00Z'),
  endAt: new Date('2026-10-01T00:00:00Z'),
  rewards: [],
} as unknown as CreatorProjectDetail;

describe('funding creator 미리보기 getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('비-ko locale → /ko/funding/creator/<id>/preview로 redirect (인증 검사보다 먼저)', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'en', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect(result).toEqual({ redirect: { destination: '/ko/funding/creator/proj-1/preview', permanent: false } });
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

  it('필수값이 빈 초안 → props에 incomplete: true (404가 아니다)', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
    (loadProjectForCreator as jest.Mock).mockResolvedValue(DRAFT_PROJECT);
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect('props' in (result as object)).toBe(true);
    const props = (result as unknown as { props: { incomplete: boolean; projectId: string } }).props;
    expect(props.incomplete).toBe(true);
    expect(props.projectId).toBe('proj-1');
  });

  // 초안 시절 rowsToFundingProject에 넘긴 합성 객체가 `content`를 빠뜨려, 완성된 프로젝트에서도
  // getServerSideProps가 undefined가 섞인 props를 만들어(또는 MarkdownRenderer가 그 값을
  // 받아) 항상 터졌다. 완성된 프로젝트 경로가 실제로 끝까지 성공하는지, 그리고 본문이
  // 제대로 실리는지를 함께 본다.
  it('완성된 프로젝트 → props에 project.content가 실린다(내려받기 주소는 벗긴다)', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
    (loadProjectForCreator as jest.Mock).mockResolvedValue(COMPLETE_PROJECT);
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect('props' in (result as object)).toBe(true);
    const props = (result as unknown as {
      props: { incomplete: boolean; project: { content: string; rewards: Array<{ downloads: unknown[] }> } };
    }).props;
    expect(props.incomplete).toBe(false);
    expect(props.project.content).toBe(COMPLETE_PROJECT.content);
    expect(props.project.rewards[0].downloads).toEqual([]);
  });
});
