/**
 * @jest-environment node
 *
 * jsdom 환경은 iron-session이 의존하는 uncrypto를 ESM(.mjs)으로 풀어 파싱이 깨진다
 * (index.test.ts와 같은 사유 — 이 페이지가 creatorAuth를 임포트한다).
 */
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/shows/organizer/submissions', () => ({ listSubmissionsForCreator: jest.fn() }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/[locale]/funding/creator/shows';
// eslint-disable-next-line import/first
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { listSubmissionsForCreator } from '../../../../lib/shows/organizer/submissions';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

const run = async (locale = 'ko') =>
  getServerSideProps({
    params: { locale }, query: {}, req: { headers: {}, cookies: {} }, res: resStub(),
  } as never);

describe('콘솔 공연 탭 getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
  });

  it('비-ko locale → /ko/funding/creator/shows redirect (인증 검사보다 먼저)', async () => {
    expect(await run('en')).toEqual({ redirect: { destination: '/ko/funding/creator/shows', permanent: false } });
    expect(authenticateCreatorRequest).not.toHaveBeenCalled();
  });

  it('로그인하지 않았으면 /ko/funding/apply로', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: false });
    expect(await run()).toEqual({ redirect: { destination: '/ko/funding/apply', permanent: false } });
  });

  it('본인 id로 읽고, 첫 회차를 읽기 좋은 말로 바꿔 싣는다', async () => {
    (listSubmissionsForCreator as jest.Mock).mockResolvedValue([
      { id: 's1', title: '공연', reviewStatus: 'approved', showSlug: 'live', showStatus: 'on_sale', firstShowtime: '2026-11-20T19:30' },
      { id: 's2', title: '', reviewStatus: 'draft', showSlug: null, showStatus: null, firstShowtime: null },
    ]);
    const result = (await run()) as unknown as { props: { shows: unknown[]; loadFailed: boolean } };
    expect(listSubmissionsForCreator).toHaveBeenCalledWith('creator-a');
    expect(result.props.loadFailed).toBe(false);
    expect(result.props.shows).toEqual([
      { id: 's1', title: '공연', reviewStatus: 'approved', showSlug: 'live', firstShowtimeLabel: '2026년 11월 20일(금) 19:30' },
      { id: 's2', title: '', reviewStatus: 'draft', showSlug: null, firstShowtimeLabel: null },
    ]);
  });

  it('표가 없어도(마이그레이션 전) 페이지는 뜬다 — 목록만 비고 실패를 알린다', async () => {
    (listSubmissionsForCreator as jest.Mock).mockRejectedValue(new Error('no such table: show_submissions'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = (await run()) as unknown as { props: { shows: unknown[]; loadFailed: boolean } };
    expect(result.props).toMatchObject({ shows: [], loadFailed: true });
    spy.mockRestore();
  });
});
