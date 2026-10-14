/**
 * @jest-environment node
 *
 * jsdom 환경은 iron-session이 의존하는 uncrypto를 ESM(.mjs)으로 풀어 파싱이 깨진다
 * (lib/funding/creatorAuth.test.ts와 같은 사유 — 이 페이지가 creatorAuth를 임포트한다).
 */
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectList', () => ({ listProjectsForCreator: jest.fn() }));
jest.mock('../../../../lib/funding/creatorStats', () => ({ loadCreatorProjectStats: jest.fn() }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/[locale]/funding/creator';
// eslint-disable-next-line import/first
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { listProjectsForCreator } from '../../../../lib/funding/creatorProjectList';
// eslint-disable-next-line import/first
import { loadCreatorProjectStats } from '../../../../lib/funding/creatorStats';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

describe('funding creator 목록 getServerSideProps', () => {
  // funding의 다른 SSR 형제 페이지(success·manage/[orderNo])와 같은 자리, 같은 방식 —
  // 세션 쿠키가 path=/라 로케일을 가리지 않으므로, 이 가드가 없으면 /en/funding/creator가
  // 인증 검사를 그대로 통과해 같은 화면이 7개 URL로 존재하게 된다(2026-09-17 리뷰 지적).
  // 인증 검사보다 먼저 걸려야 하므로 세션·DB 목이 없어도 이 리다이렉트가 나와야 한다.
  it('비-ko locale → /ko/funding/creator redirect (인증 검사보다 먼저)', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'en' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect(result).toEqual({ redirect: { destination: '/ko/funding/creator', permanent: false } });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

/**
 * 목록의 한 줄 요약 — 모금액·달성률·건수뿐이다. 후원자 이름·응원 메시지·연락처·배송지는
 * 집계 함수가 애초에 돌려주지 않고(`lib/funding/creatorStats.integration.test.ts`),
 * 여기서는 그 집계가 **승인된 프로젝트에만**, **본인 id로만** 조회되는지를 본다.
 */
describe('모금 현황 props', () => {
  const summary = (over: Record<string, unknown>) => ({
    id: 'p1', slug: 'live', title: '제목', reviewStatus: 'approved', status: 'auto',
    reviewNote: null, updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  });
  const STATS = { raisedAmount: 100_000, goalAmount: 1_000_000, percent: 10, backerCount: 3, rewards: [] };

  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
  });

  const run = async () => {
    const result = await getServerSideProps({
      params: { locale: 'ko' }, query: {}, req: { headers: {}, cookies: {} }, res: resStub(),
    } as never);
    return (result as unknown as { props: { stats: Record<string, unknown> } }).props;
  };

  it('승인된 프로젝트만 집계하고, 조회는 본인 id로만 한다', async () => {
    (listProjectsForCreator as jest.Mock).mockResolvedValue([
      summary({ id: 'p1' }),
      summary({ id: 'p2', reviewStatus: 'draft' }),
    ]);
    (loadCreatorProjectStats as jest.Mock).mockResolvedValue(STATS);

    const props = await run();
    expect(loadCreatorProjectStats).toHaveBeenCalledTimes(1);
    expect(loadCreatorProjectStats).toHaveBeenCalledWith('creator-a', 'p1');
    expect(props.stats).toEqual({ p1: STATS });
  });

  it('집계 조회가 실패해도 목록은 뜬다 — 그 프로젝트만 현황이 빠진다', async () => {
    (listProjectsForCreator as jest.Mock).mockResolvedValue([summary({ id: 'p1' })]);
    (loadCreatorProjectStats as jest.Mock).mockRejectedValue(new Error('DB 없음'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await run()).stats).toEqual({});
    spy.mockRestore();
  });
});
