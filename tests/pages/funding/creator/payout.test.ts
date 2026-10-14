/**
 * @jest-environment node
 *
 * 콘솔 정산 정보 탭 getServerSideProps. jsdom은 iron-session의 uncrypto(ESM)를 못 풀어 node 환경이다(shows.test.ts와 같다).
 */
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorEligibility', () => ({ hasApprovedEngagement: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadPayoutSummary: jest.fn() }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/[locale]/funding/creator/payout';
// eslint-disable-next-line import/first
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { hasApprovedEngagement } from '../../../../lib/funding/creatorEligibility';
// eslint-disable-next-line import/first
import { loadPayoutSummary } from '../../../../lib/funding/creatorProjectWrite';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

const run = async (locale = 'ko') =>
  getServerSideProps({
    params: { locale }, query: {}, req: { headers: {}, cookies: {} }, res: resStub(),
  } as never);

const SUMMARY = {
  registered: true, accountLast4: '9012', taxType: 'withholding', residentNumberRegistered: true,
  withheldPayoutRecorded: false, business: null,
};

describe('콘솔 정산 정보 탭 getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'creator-a' });
    (hasApprovedEngagement as jest.Mock).mockResolvedValue(true);
    (loadPayoutSummary as jest.Mock).mockResolvedValue(SUMMARY);
  });

  it('비-ko locale → /ko/funding/creator/payout redirect (인증 검사보다 먼저)', async () => {
    expect(await run('en')).toEqual({ redirect: { destination: '/ko/funding/creator/payout', permanent: false } });
    expect(authenticateCreatorRequest).not.toHaveBeenCalled();
  });

  it('로그인하지 않았으면 /ko/funding/apply로', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: false });
    expect(await run()).toEqual({ redirect: { destination: '/ko/funding/apply', permanent: false } });
  });

  it('승인된 것이 없으면 요약을 읽지 않고 eligible: false', async () => {
    (hasApprovedEngagement as jest.Mock).mockResolvedValue(false);
    const result = await run() as unknown as { props: Record<string, unknown> };
    expect(result.props).toMatchObject({ eligible: false, payout: null });
    expect(loadPayoutSummary).not.toHaveBeenCalled();
  });

  it('승인된 계정이면 본인 id로 요약을 읽어 싣는다', async () => {
    const result = await run() as unknown as { props: Record<string, unknown> };
    expect(hasApprovedEngagement).toHaveBeenCalledWith('creator-a');
    expect(loadPayoutSummary).toHaveBeenCalledWith('creator-a');
    expect(result.props).toMatchObject({ eligible: true, payout: SUMMARY });
  });
});
