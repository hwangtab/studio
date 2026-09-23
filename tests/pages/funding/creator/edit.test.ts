/**
 * @jest-environment node
 *
 * funding SSR 형제 테스트 전부가 node 환경을 쓰는 관례를 따른다 — jsdom은
 * iron-session이 의존하는 uncrypto를 ESM(.mjs)으로 풀어 파싱이 깨진다
 * (lib/funding/creatorAuth.test.ts와 같은 사유 — 이 페이지가 creatorAuth를 임포트한다).
 */
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({
  loadProjectForCreator: jest.fn(),
  isCreatorNameLocked: jest.fn().mockResolvedValue(false),
  loadPayoutSummary: jest.fn().mockResolvedValue({ registered: false, accountLast4: null, taxType: null }),
}));
jest.mock('../../../../lib/funding/creatorStats', () => ({ loadCreatorProjectStats: jest.fn().mockResolvedValue(null) }));

// eslint-disable-next-line import/first
import { getServerSideProps, toEditorProject } from '../../../../pages/[locale]/funding/creator/[id]';
// eslint-disable-next-line import/first
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import {
  isCreatorNameLocked, loadPayoutSummary, loadProjectForCreator, type CreatorProjectDetail,
} from '../../../../lib/funding/creatorProjectWrite';
// eslint-disable-next-line import/first
import { loadCreatorProjectStats } from '../../../../lib/funding/creatorStats';
// eslint-disable-next-line import/first
import { computeEarliestStartDate } from '../../../../lib/funding/creatorDateInput';
// eslint-disable-next-line import/first
import { CREATOR_LIMITS } from '../../../../lib/funding/creatorValidation';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

/**
 * 실제 DB 행처럼 개설자의 비공개 필드(taxType 등)까지 채운 목이다. `CreatorProjectDetail.creator`
 * 타입은 5필드뿐이지만, `toEditorProject`가 실수로 `creator: p.creator`처럼 통째 스프레드하는
 * 회귀를 잡으려면 애초에 그 필드들이 객체에 실려 있어야 한다 — 타입에 없는 필드만 골라
 * 뺀 목으로는(이전 버전처럼) 그 회귀가 조용히 통과한다(2026-09-17 리뷰 지적).
 */
const PROJECT = {
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
    // 아래 다섯은 EditorCreatorProfile에 없어야 하는 필드다.
    email: 'creator@example.com',
    taxType: 'individual',
    payoutBankName: '국민은행',
    payoutAccount: '123-456-789012',
    payoutHolder: '정산예금주',
  },
  rewards: [],
} as unknown as CreatorProjectDetail;

// EditorProject(components/funding/creator/types.ts)가 실제로 선언한 필드 전체 — 새 필드가
// `toEditorProject`에 추가됐는데 여기를 안 고치면 이 화이트리스트 자체가 실패해 드러난다.
const EDITOR_PROJECT_KEYS = [
  'id', 'slug', 'title', 'summary', 'content', 'coverUrl', 'goalAmount',
  'startAt', 'endAt', 'reviewStatus', 'reviewNote', 'creator', 'rewards',
].sort();

describe('toEditorProject', () => {
  // 이메일은 findMissingRequiredSections(isDefaultCreatorName 판정)가 쓰려고
  // loadProjectForCreator에 추가된 값이라 서버 안에서만 돌아야 한다. props에 실리면
  // __NEXT_DATA__로 페이지 소스에 나간다.
  it('개설자 화면 props에 이메일이 실리지 않는다', () => {
    const editor = toEditorProject(PROJECT);
    expect(JSON.stringify(editor)).not.toContain('creator@example.com');
    expect(Object.keys(editor.creator).sort()).toEqual(['bio', 'contactName', 'links', 'name', 'phone']);
  });
});

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

  it('본인 프로젝트 → props에 담고, 개설자 비공개 필드(taxType 등)는 없다', async () => {
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
    // KST 달력 날짜 문자열이어야 한다(<input type="date">가 그대로 받는 형식) — 전체
    // ISO 타임스탬프였을 때는 저장→재저장을 반복할 때마다 날짜가 하루씩 밀렸다
    // (lib/funding/creatorDateInput.ts 주석 참조).
    expect(props.project.startAt).toBe('2026-10-01');
    expect(props.project.endAt).toBe('2026-11-01');

    // 블랙리스트(특정 단어가 없다)만으로는 `creator: p.creator` 통째 스프레드 회귀를
    // 못 잡는다 — 화이트리스트로 project 레벨 키 집합 자체를 고정한다.
    expect(Object.keys(props.project).sort()).toEqual(EDITOR_PROJECT_KEYS);

    // props.project만 본다 — props 전체(i18nResources)에는 로케일 카피용
    // "email"(연락처 라벨) 같은 무관한 동음이 섞여 있어 오탐이 난다.
    const serialized = JSON.stringify(props.project);
    expect(serialized).not.toContain('taxType');
    expect(serialized).not.toContain('payoutAccount');
    expect(serialized).not.toContain('payoutBankName');
    expect(serialized).not.toContain('payoutHolder');
    expect(serialized).not.toContain('email');

    const creator = props.project.creator as Record<string, unknown>;
    expect(Object.keys(creator).sort()).toEqual(['bio', 'contactName', 'links', 'name', 'phone'].sort());
  });

  describe('nameLocked', () => {
    it('isCreatorNameLocked가 true면 props.nameLocked도 true다', async () => {
      (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (isCreatorNameLocked as jest.Mock).mockResolvedValue(true);
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
      } as never);
      const props = (result as unknown as { props: { nameLocked: boolean } }).props;
      expect(props.nameLocked).toBe(true);
      expect(isCreatorNameLocked).toHaveBeenCalledWith('creator-a');
    });

    it('isCreatorNameLocked가 false면 props.nameLocked도 false다', async () => {
      (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (isCreatorNameLocked as jest.Mock).mockResolvedValue(false);
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
      } as never);
      const props = (result as unknown as { props: { nameLocked: boolean } }).props;
      expect(props.nameLocked).toBe(false);
    });
  });

  /**
   * 정산 정보는 props로 나가는 순간 `__NEXT_DATA__` JSON에 실려 페이지 소스에 평문으로
   * 박힌다 — 개설자 본인 화면도 예외가 아니다. `lib/funding/dbProjects.integration.test.ts`의
   * 같은 모양 테스트(비공개 개설자 필드가 공개 프로젝트에 안 실린다)와 짝이다.
   */
  describe('정산 정보 props — 등록 여부·뒤 4자리·세금 유형만 나간다', () => {
    it('계좌번호 전체·은행명·예금주는 props 어디에도 없다', async () => {
      (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      (loadPayoutSummary as jest.Mock).mockResolvedValue({
        registered: true, accountLast4: '9012', taxType: 'withholding',
      });
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
      } as never);
      const props = (result as unknown as { props: { payout: Record<string, unknown> } }).props;

      expect(props.payout).toEqual({ registered: true, accountLast4: '9012', taxType: 'withholding' });
      expect(Object.keys(props.payout).sort()).toEqual(['accountLast4', 'registered', 'taxType']);
      expect(loadPayoutSummary).toHaveBeenCalledWith('creator-a');

      // props.project + props.payout을 함께 직렬화해 원본 값이 어느 쪽으로도 새지 않는지 본다
      // (i18nResources는 로케일 카피에 동음이 섞여 오탐이 나므로 뺀다).
      const serialized = JSON.stringify({
        project: (props as unknown as { project: unknown }).project,
        payout: props.payout,
      });
      expect(serialized).not.toContain('123-456-789012');
      expect(serialized).not.toContain('국민은행');
      expect(serialized).not.toContain('정산예금주');
      expect(serialized).not.toContain('payoutAccount');
      expect(serialized).not.toContain('payoutBankName');
      expect(serialized).not.toContain('payoutHolder');
    });
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

  describe('earliestStartDate', () => {
    afterEach(() => jest.useRealTimers());

    it('서버의 now로 계산해 props에 담는다(브라우저 시계를 다시 쓰지 않는다)', async () => {
      const fixedNow = new Date('2026-09-17T05:00:00.000Z'); // = 2026-09-17T14:00+09:00
      jest.useFakeTimers().setSystemTime(fixedNow);

      (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
      (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
      const res = resStub();
      const result = await getServerSideProps({
        params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res,
      } as never);
      const props = (result as unknown as { props: { earliestStartDate: string } }).props;
      expect(props.earliestStartDate).toBe(computeEarliestStartDate(fixedNow.getTime(), CREATOR_LIMITS.leadDays));
    });
  });
});

/**
 * 모금 현황은 **집계만** props로 나간다. 개설자 약관 제8조가 "서포터의 개인정보는 스튜디오가
 * 보유하며, 개설자에게 제공하지 않습니다"라고 적고 있고, props는 `__NEXT_DATA__`로 페이지
 * 소스에 그대로 실린다 — 집계 함수 쪽 방어는 `lib/funding/creatorStats.integration.test.ts`가,
 * 이 화면까지 그대로 오는지는 여기가 본다.
 */
describe('모금 현황 props', () => {
  const STATS = {
    raisedAmount: 100_000,
    goalAmount: 1_000_000,
    percent: 10,
    backerCount: 3,
    rewards: [{ rewardId: 'cd', title: 'CD', quantity: 3, totalQuantity: 100 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
    (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
    (isCreatorNameLocked as jest.Mock).mockResolvedValue(false);
    (loadPayoutSummary as jest.Mock).mockResolvedValue({ registered: false, accountLast4: null, taxType: null });
  });

  const run = async () => {
    const result = await getServerSideProps({
      params: { locale: 'ko', id: 'proj-1' }, query: {}, req: { headers: {}, cookies: {} }, res: resStub(),
    } as never);
    return (result as unknown as { props: { stats: unknown } }).props;
  };

  it('본인 id와 프로젝트 id로만 조회하고, 집계를 props에 담는다', async () => {
    (loadCreatorProjectStats as jest.Mock).mockResolvedValue(STATS);
    const props = await run();
    expect(loadCreatorProjectStats).toHaveBeenCalledWith('creator-a', 'proj-1');
    expect(props.stats).toEqual(STATS);
    // 집계 외의 것이 섞여 들어오면 여기서 드러난다.
    expect(Object.keys(props.stats as object).sort())
      .toEqual(['backerCount', 'goalAmount', 'percent', 'raisedAmount', 'rewards']);
  });

  it('승인 전이면(집계 함수가 null) props도 null이다 — 화면이 구획을 감춘다', async () => {
    (loadCreatorProjectStats as jest.Mock).mockResolvedValue(null);
    expect((await run()).stats).toBeNull();
  });

  it('집계 조회가 실패해도 편집 화면은 열린다', async () => {
    (loadCreatorProjectStats as jest.Mock).mockRejectedValue(new Error('DB 없음'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await run()).stats).toBeNull();
    spy.mockRestore();
  });
});
