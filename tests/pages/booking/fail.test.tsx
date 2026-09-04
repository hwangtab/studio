/** @jest-environment node */

import { getServerSideProps } from '../../../pages/[locale]/booking/fail';

/**
 * 결제 실패 화면의 "예약 페이지로 돌아가기"가 상품과 맞아야 한다.
 *
 * 예전엔 목적지가 /ko/booking/recording으로 하드코딩돼 있어, 축가 고객이 카드 한도로
 * 결제에 실패하면 녹음 예약 페이지로 갔다. failUrl에 service를 싣고 여기서 되돌린다.
 *
 * 쿼리값은 사용자가 조작할 수 있으므로 상품 정본(SESSION_PRODUCTS)에 있는 값만 쓴다.
 */

type Ctx = Parameters<typeof getServerSideProps>[0];
type Ok = { props: { service: string; code?: string; message?: string } };

const run = async (query: Record<string, string>): Promise<Ok> =>
  (await getServerSideProps({
    query,
    params: { locale: 'ko' },
    res: { setHeader: jest.fn() },
  } as unknown as Ctx)) as Ok;

describe('결제 실패 페이지 — 돌아갈 예약 페이지', () => {
  it.each(['recording', 'voice-acting', 'wedding-song', 'cover-video'])(
    '%s 예약은 같은 상품의 예약 페이지로 되돌린다',
    async (service) => {
      const r = await run({ service });
      expect(r.props.service).toBe(service);
    },
  );

  it('service가 없으면 녹음으로 되돌린다 (기존 동작)', async () => {
    expect((await run({})).props.service).toBe('recording');
  });

  it('모르는 값은 경로에 그대로 넣지 않는다', async () => {
    // 조작된 쿼리가 링크 목적지가 되면 안 된다.
    for (const bad of ['../../evil', 'https://evil.example', 'practice-room', '']) {
      expect((await run({ service: bad })).props.service).toBe('recording');
    }
  });

  it('code·message는 있을 때만 넘긴다', async () => {
    const r = await run({ service: 'wedding-song', code: 'PAY_PROCESS_CANCELED' });
    expect(r.props.code).toBe('PAY_PROCESS_CANCELED');
    expect(r.props).not.toHaveProperty('message');
  });
});
