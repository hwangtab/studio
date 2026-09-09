/** @jest-environment node */

jest.mock('../../../lib/billing/service', () => ({ findSubscriptionForSetup: jest.fn() }));

import { findSubscriptionForSetup } from '../../../lib/billing/service';
import { getServerSideProps } from '../../../pages/[locale]/subscribe/[id]';

type Ctx = Parameters<typeof getServerSideProps>[0];
type Result = { props: Record<string, unknown> };

const run = async (query: Record<string, string>): Promise<Result> =>
  (await getServerSideProps({
    query,
    params: { locale: 'ko', id: 'sub-1' },
    res: { setHeader: jest.fn() },
  } as unknown as Ctx)) as unknown as Result;

const mockFind = findSubscriptionForSetup as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('토큰 없이 접근하면 not_found 에러 화면', async () => {
  const r = await run({});
  expect(r.props).toEqual({ outcome: 'error', code: 'not_found' });
  expect(mockFind).not.toHaveBeenCalled();
});

it('만료된 링크는 expired 코드를 그대로 전달', async () => {
  mockFind.mockResolvedValue({ ok: false, code: 'expired' });
  const r = await run({ token: 'tok' });
  expect(r.props).toEqual({ outcome: 'error', code: 'expired' });
});

it('유효한 링크면 구독 정보를 화면에 내려준다(빌링키·시크릿은 노출하지 않는다)', async () => {
  mockFind.mockResolvedValue({
    ok: true,
    subscription: {
      id: 'sub-1',
      kind: 'practice-room',
      customerKey: 'sub_abc',
      customerName: '홍길동',
      customerEmail: 'hong@example.com',
      itemAmount: 360000,
      vatAmount: 36000,
      totalAmount: 396000,
      billingDay: 5,
      setupMode: 'initial',
    },
  });
  const r = await run({ token: 'tok' });
  expect(r.props).toMatchObject({
    outcome: 'ok',
    id: 'sub-1',
    setupToken: 'tok',
    customerKey: 'sub_abc',
    totalAmount: 396000,
    billingDay: 5,
    setupMode: 'initial',
  });
  expect(r.props).not.toHaveProperty('billingKey');
});
