/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';

import handler from '../../../pages/api/press/optouts';
import { PRESS_HOST } from '../../../lib/press/host';
import { PRESS_OPTOUT_PAGE_SIZE, listPressOptouts } from '../../../lib/press/optouts';

jest.mock('../../../lib/press/optouts', () => ({
  PRESS_OPTOUT_PAGE_SIZE: 3,
  listPressOptouts: jest.fn(async () => []),
}));

const list = listPressOptouts as jest.MockedFunction<typeof listPressOptouts>;

const TOKEN = 'pull-token-for-tests';

const createResponse = () => {
  let body = '';
  let statusCode = 200;
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = String(value);
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = JSON.stringify(payload);
      return this;
    },
    send(payload: unknown) {
      body = String(payload);
      return this;
    },
    end(payload?: unknown) {
      body = payload === undefined ? '' : String(payload);
      return this;
    },
  } as unknown as NextApiResponse;
  return { res, getStatus: () => statusCode, getJson: () => JSON.parse(body || '{}') };
};

const call = async (opts: { host?: string; since?: string; token?: string; method?: string } = {}) => {
  const out = createResponse();
  await handler(
    {
      method: opts.method ?? 'GET',
      query: opts.since === undefined ? {} : { since: opts.since },
      headers: {
        host: opts.host ?? 'studionol.co.kr',
        authorization: `Bearer ${opts.token ?? TOKEN}`,
      },
    } as unknown as NextApiRequest,
    out.res,
  );
  return out;
};

const row = (createdAt: number) => ({ emailHash: 'a'.repeat(32), campaignSlug: 'c', createdAt });

describe('/api/press/optouts', () => {
  const original = process.env.PRESS_PULL_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    list.mockResolvedValue([]);
    process.env.PRESS_PULL_TOKEN = TOKEN;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.PRESS_PULL_TOKEN;
    else process.env.PRESS_PULL_TOKEN = original;
  });

  /**
   * 미들웨어의 호스트 분기는 이 경로를 못 막는다 — config.matcher가 `api`를 애초에
   * 미들웨어에 태우지 않는다. 그래서 핸들러가 직접 막는다. 이 단언이 사라지면
   * 명단 전체를 돌려주는 경로가 수신거부 전용 호스트에 함께 열린다.
   */
  it('press 전용 호스트에서는 키가 맞아도 404다', async () => {
    const out = await call({ host: PRESS_HOST });
    expect(out.getStatus()).toBe(404);
    expect(list).not.toHaveBeenCalled();
  });

  it('본진 호스트에서는 정상 응답한다', async () => {
    const out = await call();
    expect(out.getStatus()).toBe(200);
    expect(out.getJson().ok).toBe(true);
  });

  it('키가 틀리면 404다 — 존재를 알리지 않는다', async () => {
    const out = await call({ token: 'wrong' });
    expect(out.getStatus()).toBe(404);
  });

  /**
   * 상한을 채우지 않은 평범한 응답에서는 now가 서버 시각이어야 한다. 그러지
   * 않으면 호출부의 since가 전진하지 않아 가드가 영구히 막힌다.
   */
  it('상한 미만이면 now는 서버 시각이고 more는 false다', async () => {
    list.mockResolvedValue([row(1789000000)]);
    const body = (await call({ since: '0' })).getJson();
    expect(body.more).toBe(false);
    expect(body.now).toBeGreaterThan(1789000000);
  });

  /**
   * 상한만큼 찼는데도 now를 서버 시각으로 주면, 상한을 넘은 행들은 그 구간이
   * 통째로 지나가 영영 다시 읽히지 않는다. 겹쳐 읽는 것은 안전하고(ON CONFLICT
   * DO NOTHING), 덜 읽는 것만 위험하다.
   */
  it('상한이 꽉 차면 now를 마지막 행 시각으로만 전진시키고 more를 켠다', async () => {
    const rows = [row(1789000010), row(1789000020), row(1789000030)];
    expect(rows.length).toBe(PRESS_OPTOUT_PAGE_SIZE);
    list.mockResolvedValue(rows);
    const body = (await call({ since: '0' })).getJson();
    expect(body.more).toBe(true);
    // 같은 초에 들어온 형제 행이 상한 밖으로 밀렸을 수 있어 1초를 겹쳐 읽는다.
    expect(body.now).toBe(1789000029);
  });

  it('GET이 아니면 405다', async () => {
    const out = await call({ method: 'POST' });
    expect(out.getStatus()).toBe(405);
  });
});
