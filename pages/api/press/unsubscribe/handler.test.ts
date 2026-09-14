/** @jest-environment node */

import fs from 'fs';
import path from 'path';

import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './[token]';
import { recordPressOptout } from '../../../../lib/press/optouts';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { renderUnsubPage } from '../../../../lib/press/page';

jest.mock('../../../../lib/press/optouts', () => ({
  recordPressOptout: jest.fn(async () => undefined),
}));
jest.mock('../../../../lib/booking/rate-limit', () => ({
  consumeRateLimit: jest.fn(async () => true),
}));

const record = recordPressOptout as jest.MockedFunction<typeof recordPressOptout>;
const rateLimit = consumeRateLimit as jest.MockedFunction<typeof consumeRateLimit>;

/**
 * 토큰은 music-promo가 서명한 실물 벡터를 쓴다.
 *
 * 테스트 안에서 새로 서명하면 이쪽 구현으로 만들어 이쪽 구현으로 검증하는 셈이라,
 * 두 저장소가 갈라지는 바로 그 사고를 통과시킨다.
 */
const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'tests', 'press', 'press-token-vectors.json'), 'utf8'),
) as { secret: string; cases: { payload: { h: string; c: string; l: string }; token: string }[] };

const VALID = vectors.cases[0];

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
    send(payload: unknown) {
      body = String(payload);
      return this;
    },
    json(payload: unknown) {
      body = JSON.stringify(payload);
      return this;
    },
    end(payload?: unknown) {
      body = payload === undefined ? '' : String(payload);
      return this;
    },
  } as unknown as NextApiResponse;
  return { res, getBody: () => body, getStatus: () => statusCode, getHeader: (n: string) => headers[n.toLowerCase()] };
};

const call = async (req: { method: string; token?: string; body?: unknown }) => {
  const out = createResponse();
  await handler(
    {
      method: req.method,
      query: req.token === undefined ? {} : { token: req.token },
      headers: {},
      body: req.body,
      socket: {},
    } as unknown as NextApiRequest,
    out.res,
  );
  return out;
};

/**
 * 사양 5절 검증표를 코드로 옮긴 것.
 *
 * 이 파일은 오래 renderUnsubPage만 보고 있었다. 화면은 모양이고, 이 기능의 약속은
 * 핸들러에 있다 — 특히 **GET은 아무것도 기록하지 않는다**가 설계의 핵심인데
 * 아무 테스트도 그걸 붙들고 있지 않았다. 메일 본문 링크는 스팸 필터와 보안
 * 게이트웨이가 미리 열어 보므로, 이게 깨지면 기자가 누른 적도 없는데 거부 처리된다.
 */
describe('수신거부 핸들러', () => {
  const originalSecret = process.env.PRESS_UNSUB_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimit.mockResolvedValue(true);
    process.env.PRESS_UNSUB_SECRET = vectors.secret;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.PRESS_UNSUB_SECRET;
    else process.env.PRESS_UNSUB_SECRET = originalSecret;
  });

  it('GET은 확인 화면(HTML)을 주고 아무것도 기록하지 않는다', async () => {
    const out = await call({ method: 'GET', token: VALID.token });
    expect(out.getStatus()).toBe(200);
    expect(out.getHeader('content-type')).toBe('text/html; charset=utf-8');
    expect(out.getBody()).toContain('<form');
    expect(record).not.toHaveBeenCalled();
  });

  it('원클릭 POST는 즉시 반영하고 204로 끝낸다 (본문을 보는 사람이 없다)', async () => {
    const out = await call({ method: 'POST', token: VALID.token, body: { 'List-Unsubscribe': 'One-Click' } });
    expect(out.getStatus()).toBe(204);
    expect(out.getBody()).toBe('');
    expect(record).toHaveBeenCalledWith({
      emailHash: VALID.payload.h,
      campaignSlug: VALID.payload.c,
      source: 'one-click',
    });
  });

  it('확인 화면의 POST(via=page)는 완료 화면을 보여주고 source를 page로 남긴다', async () => {
    const out = await call({ method: 'POST', token: VALID.token, body: { via: 'page' } });
    expect(out.getStatus()).toBe(200);
    expect(out.getHeader('content-type')).toBe('text/html; charset=utf-8');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ source: 'page' }));
  });

  /** 두 번 눌렀다고 실패를 주면 수신자는 거부가 안 된 줄 안다. */
  it('같은 토큰으로 두 번 보내도 둘 다 성공한다', async () => {
    expect((await call({ method: 'POST', token: VALID.token, body: {} })).getStatus()).toBe(204);
    expect((await call({ method: 'POST', token: VALID.token, body: {} })).getStatus()).toBe(204);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('잘못된 토큰은 기록 없이 400이다 (POST는 JSON, GET은 화면)', async () => {
    const post = await call({ method: 'POST', token: 'not.atoken', body: {} });
    expect(post.getStatus()).toBe(400);
    const get = await call({ method: 'GET', token: 'not.atoken' });
    expect(get.getStatus()).toBe(400);
    expect(get.getHeader('content-type')).toBe('text/html; charset=utf-8');
    expect(record).not.toHaveBeenCalled();
  });

  it('토큰이 아예 없어도 기록하지 않는다', async () => {
    expect((await call({ method: 'GET' })).getStatus()).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });

  /**
   * 비밀키가 없으면 어떤 토큰도 검증할 수 없다. 이때 "수신거부되었습니다"를 보여
   * 주면 실제로는 아무것도 기록되지 않았는데 기자는 끝난 줄 안다.
   */
  it('PRESS_UNSUB_SECRET이 없으면 500이고 아무것도 기록하지 않는다', async () => {
    delete process.env.PRESS_UNSUB_SECRET;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const out = await call({ method: 'POST', token: VALID.token, body: {} });
    spy.mockRestore();
    expect(out.getStatus()).toBe(500);
    expect(record).not.toHaveBeenCalled();
  });

  it('다른 메서드는 405이고 Allow를 붙인다', async () => {
    const out = await call({ method: 'DELETE', token: VALID.token });
    expect(out.getStatus()).toBe(405);
    expect(out.getHeader('allow')).toBe('GET, POST');
    expect(record).not.toHaveBeenCalled();
  });

  /** 검증을 rate limit보다 먼저 하므로, 유효한 토큰만 한도에 걸린다. */
  it('한도를 넘기면 429이고 기록하지 않는다', async () => {
    rateLimit.mockResolvedValue(false);
    const out = await call({ method: 'POST', token: VALID.token, body: {} });
    expect(out.getStatus()).toBe(429);
    expect(record).not.toHaveBeenCalled();
  });

  it('기록에 실패하면 500이다 — 완료 화면을 보여주지 않는다', async () => {
    record.mockRejectedValueOnce(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const out = await call({ method: 'POST', token: VALID.token, body: { via: 'page' } });
    expect(out.getStatus()).toBe(500);
    spy.mockRestore();
  });
});

/**
 * 확인 화면은 기자가 보는 유일한 우리 화면이다.
 *
 * 여기서 고정하는 것은 모양이 아니라 **약속** 세 가지다.
 *   1. GET 화면은 아직 거부를 반영하지 않았다고 말한다(버튼을 눌러야 한다).
 *   2. 되돌리기 버튼을 두지 않는다 — registry에 해제 경로가 의도적으로 없는데
 *      화면에만 만들면 그 원칙이 무너진다. 회신으로 안내한다.
 *   3. 토큰이 화면 밖으로 새지 않는다(폼 안에만 있고 링크에는 없다).
 */
describe('renderUnsubPage', () => {
  it('확인 화면은 버튼을 누르라고 말하고 토큰을 폼에 담는다', () => {
    const html = renderUnsubPage('confirm', 'ko', 'TOKEN123');
    expect(html).toContain('<form');
    expect(html).toContain('method="post"');
    expect(html).toContain('TOKEN123');
    expect(html).toContain('수신거부');
  });

  /**
   * via=page는 Referer 대신 쓰는 표시다. Referer를 전면 차단하는 브라우저·확장에서도
   * 사람이 이 버튼을 눌렀다는 사실이 폼 자체에 실려 있어야, 라우트가 원클릭과 정확히
   * 구분해 완료 화면을 보여줄 수 있다. 이 필드가 사라지면 사람이 눌러도 빈 204가
   * 돌아가는데, 그건 실제로 눌러 봐야만 드러난다.
   */
  it('확인 화면 폼은 via=page를 싣는다', () => {
    const html = renderUnsubPage('confirm', 'ko', 'TOKEN123');
    expect(html).toContain('name="via"');
    expect(html).toContain('value="page"');
  });

  it('완료 화면은 되돌리기 버튼 대신 회신을 안내한다', () => {
    const html = renderUnsubPage('done', 'ko', 'TOKEN123');
    expect(html).not.toContain('<form');
    expect(html).toContain('회신');
  });

  it('잘못된 토큰에도 상세한 오류를 말하지 않는다', () => {
    const html = renderUnsubPage('invalid', 'ko', '');
    expect(html).not.toMatch(/서명|signature|HMAC|만료/);
  });

  it('알 수 없는 로케일은 영어로 떨어진다', () => {
    const html = renderUnsubPage('confirm', 'xx', 'T');
    expect(html).toContain('lang="en"');
  });

  it('토큰을 HTML에 그대로 끼워 넣지 않는다 (따옴표 이스케이프)', () => {
    const html = renderUnsubPage('confirm', 'ko', '"><script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
