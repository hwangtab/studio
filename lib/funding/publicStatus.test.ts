/** @jest-environment node */
import type { FundingProject } from './shape';

jest.mock('./service', () => ({ aggregateProjectStatus: jest.fn() }));

// eslint-disable-next-line import/first
import { buildPublicStatus, buildPublicStatusOrNull } from './publicStatus';
// eslint-disable-next-line import/first
import { aggregateProjectStatus } from './service';

const mocked = aggregateProjectStatus as jest.MockedFunction<typeof aggregateProjectStatus>;

const project = {
  slug: 'demo',
  goalAmount: 1000000,
  startAt: '2026-01-01T00:00:00+09:00',
  endAt: '2036-01-01T00:00:00+09:00',
  status: 'auto',
} as unknown as FundingProject;

const aggregate = {
  raisedAmount: 240000,
  backerCount: 7,
  backerPersonCount: 7,
  remaining: { mp3: 5 },
  publicBackers: ['김정곤'],
  publicMessages: [{ name: '김정곤', message: '침략전쟁 반대한다!', at: 1758000000 }],
};

beforeEach(() => mocked.mockResolvedValue(aggregate));

/**
 * 이 모양이 곧 `/api/funding/[slug]/status`의 응답이고, 정적 생성이 실어 보내는 초기값이다.
 * 두 경로가 각자 조립하면 한쪽만 고쳤을 때 조용히 갈린다 — 그래서 한 함수로 모은다.
 */
it('상태 API가 내보내는 것과 같은 모양을 만든다', async () => {
  const s = await buildPublicStatus(project, new Date('2026-09-21T00:00:00Z'));

  expect(s).toEqual({
    state: 'live',
    goalAmount: 1000000,
    endAt: '2036-01-01T00:00:00+09:00',
    raisedAmount: 240000,
    backerCount: 7,
    percent: 24,
    remaining: { mp3: 5 },
    publicBackers: ['김정곤'],
    publicMessages: [{ name: '김정곤', message: '침략전쟁 반대한다!', at: 1758000000 }],
  });
});

// 달성률은 내림이다. 99.9%를 100%로 올리면 아직 목표에 못 미친 프로젝트가 달성한 것처럼
// 보인다 — 막대와 숫자가 같은 화면에 있어 더 그렇다.
it('달성률은 올리지 않고 버린다', async () => {
  mocked.mockResolvedValue({ ...aggregate, raisedAmount: 999999 });

  const s = await buildPublicStatus(project, new Date('2026-09-21T00:00:00Z'));

  expect(s.percent).toBe(99);
});

/**
 * 후원자 이름과 응원 메시지는 정적 HTML에 넣지 않는다.
 *
 * 지금까지 이 둘은 폴링 응답으로만 왔다 — JS를 실행하지 않는 크롤러에게는 보이지 않았다는
 * 뜻이다. 정적 생성에 실으면 검색엔진이 후원자 명단을 색인한다. 이 저장소가 여는 펀딩은
 * 파병 반대·팔레스타인 연대처럼 정치적 사안이라, 누가 후원했는지가 검색에 남는 것은
 * 모금액이 보이는 것과 전혀 다른 무게다.
 *
 * 공개 철회도 같은 문제다. 후원자가 관리 페이지에서 공개를 끄면 폴링은 즉시 반영하지만,
 * 정적 HTML은 ISR이 다시 만들 때까지 옛 이름을 들고 있다.
 *
 * 모금액·건수·달성률만 실어도 "얼마 모였나"는 첫 화면에서 보인다.
 */
it('정적 생성용 초기값에는 후원자 이름과 응원 메시지를 담지 않는다', async () => {
  const s = await buildPublicStatusOrNull(project, new Date('2026-09-21T00:00:00Z'));

  expect(s).not.toBeNull();
  expect(s!.raisedAmount).toBe(240000);
  expect(s!.backerCount).toBe(7);
  expect(s!.publicBackers).toEqual([]);
  expect(s!.publicMessages).toEqual([]);
});

it('집계가 실패하면 null이다 — 빌드는 DB 없이도 성공해야 한다', async () => {
  mocked.mockRejectedValue(new Error('no db'));

  await expect(buildPublicStatusOrNull(project, new Date())).resolves.toBeNull();
});
