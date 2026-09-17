/** @jest-environment node */
jest.mock('../../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorApi: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

const put = jest.fn().mockResolvedValue({ url: 'https://blob.example/funding/x.webp' });
jest.mock('@vercel/blob', () => ({ put: (...args: unknown[]) => put(...args) }));

import sharp from 'sharp';
import type { NextApiRequest, NextApiResponse } from 'next';

import handler from '../../../../pages/api/funding/creator/upload';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
import { loadProjectForCreator } from '../../../../lib/funding/creatorProjectWrite';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';

const makePng = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();

/** bodyParser: false 라우트가 `for await (const chunk of req)`로 읽는 원문 바디를 흉내 낸다. */
const fakeReq = (chunks: Buffer[], query: Record<string, string> = {}, method = 'POST') =>
  ({
    method,
    headers: {},
    socket: {},
    query,
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) yield chunk;
    },
  }) as unknown as NextApiRequest;

const call = async (chunks: Buffer[], query: Record<string, string> = {}, method = 'POST') => {
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json, end: jest.fn() });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler(fakeReq(chunks, query, method), res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0], setHeader };
};

const PROJECT = {
  id: 'p1',
  content: '기존 이미지 <img src="/api/funding/media/a.webp" />',
  coverUrl: '/api/funding/media/cover.webp',
  reviewStatus: 'draft',
} as unknown as Awaited<ReturnType<typeof loadProjectForCreator>>;

beforeEach(() => {
  jest.clearAllMocks();
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(true);
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'c1' });
  (loadProjectForCreator as jest.Mock).mockResolvedValue(PROJECT);
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  put.mockResolvedValue({ url: 'https://blob.example/funding/x.webp' });
});

it('POST가 아니면 405', async () => {
  const r = await call([], { projectId: 'p1', kind: 'body' }, 'GET');
  expect(r.status).toBe(405);
});

it('허용되지 않은 Origin이면 403', async () => {
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
  const r = await call([], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(403);
  expect(authenticateCreatorApi).not.toHaveBeenCalled();
});

it('로그인하지 않았으면 401', async () => {
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call([], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(401);
});

it('projectId가 없으면 400', async () => {
  const r = await call([], { kind: 'body' });
  expect(r.status).toBe(400);
  expect(loadProjectForCreator).not.toHaveBeenCalled();
});

it('kind가 cover·body가 아니면 400', async () => {
  const r = await call([], { projectId: 'p1', kind: 'poster' });
  expect(r.status).toBe(400);
  expect(loadProjectForCreator).not.toHaveBeenCalled();
});

it('남의 프로젝트거나 없는 프로젝트면 404', async () => {
  (loadProjectForCreator as jest.Mock).mockResolvedValue(null);
  const r = await call([], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(404);
});

it('심사 중이거나 판정 난 프로젝트에는 409 — canCreatorEdit(draft·changes_requested 외)', async () => {
  for (const reviewStatus of ['submitted', 'approved', 'rejected']) {
    (loadProjectForCreator as jest.Mock).mockResolvedValue({ ...PROJECT, reviewStatus });
    const r = await call([], { projectId: 'p1', kind: 'body' });
    expect(r.status).toBe(409);
  }
  expect(put).not.toHaveBeenCalled();
});

it('changes_requested 상태는 편집 가능이라 통과한다', async () => {
  (loadProjectForCreator as jest.Mock).mockResolvedValue({ ...PROJECT, reviewStatus: 'changes_requested' });
  const r = await call([await makePng(400, 300)], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(200);
});

it('요청 제한을 넘으면 429', async () => {
  (consumeRateLimit as jest.Mock).mockResolvedValue(false);
  const r = await call([], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(429);
  expect(put).not.toHaveBeenCalled();
});

it('IP 요청 제한도 따로 본다 — 계정은 로그인 시 이메일만으로 자동 생성되므로 creatorId 하나로는 부족하다', async () => {
  const seenKeys: string[] = [];
  (consumeRateLimit as jest.Mock).mockImplementation((key: string) => {
    seenKeys.push(key);
    return Promise.resolve(true);
  });
  await call([await makePng(400, 300)], { projectId: 'p1', kind: 'body' });

  expect(seenKeys.some((k) => k.startsWith('creator_upload:ip:'))).toBe(true);
  expect(seenKeys.some((k) => k === 'creator_upload:c1')).toBe(true);
});

it('IP 요청 제한 초과만으로도 429 — creatorId 쪽은 별도로 통과했더라도', async () => {
  (consumeRateLimit as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(!key.startsWith('creator_upload:ip:')));
  const r = await call([], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(429);
  expect(put).not.toHaveBeenCalled();
});

it('프로젝트당 누적 장수를 넘으면 400 — 별도 테이블 없이 content·coverUrl에서 센다', async () => {
  const many = Array.from({ length: 30 }, (_, i) => `<img src="/api/funding/media/${i}.webp" />`).join('');
  (loadProjectForCreator as jest.Mock).mockResolvedValue({ ...PROJECT, content: many, coverUrl: '' });
  const r = await call([], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(400);
  expect(put).not.toHaveBeenCalled();
});

it('바디가 상한을 넘으면 413 — 끝까지 받지 않고 중간에 끊는다', async () => {
  const chunk = Buffer.alloc(5 * 1024 * 1024, 1);
  const r = await call([chunk, chunk], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(413);
  expect(put).not.toHaveBeenCalled();
});

it('빈 바디면 400', async () => {
  const r = await call([], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(400);
});

it('이미지가 아니면 400', async () => {
  const r = await call([Buffer.from('이건 그림이 아니다')], { projectId: 'p1', kind: 'body' });
  expect(r.status).toBe(400);
  expect(put).not.toHaveBeenCalled();
});

it('정상 업로드 → 200, private로 저장하고 프록시 주소를 돌려준다', async () => {
  const png = await makePng(800, 600);
  const r = await call([png], { projectId: 'p1', kind: 'body' });

  expect(r.status).toBe(200);
  expect(r.body.ok).toBe(true);
  expect(r.body.url).toMatch(/^\/api\/funding\/media\/[0-9a-f-]+\.webp\?w=800&h=600$/);

  expect(put).toHaveBeenCalledTimes(1);
  const [filename, buffer, options] = put.mock.calls[0];
  expect(filename).toMatch(/^funding\/[0-9a-f-]+\.webp$/);
  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(options).toEqual({ access: 'private', contentType: 'image/webp' });
});

it('Blob 저장이 실패하면 500 JSON — 다른 실패와 같은 모양(throw를 그대로 흘리지 않는다)', async () => {
  put.mockRejectedValueOnce(new Error('blob down'));
  const png = await makePng(400, 300);
  const r = await call([png], { projectId: 'p1', kind: 'body' });

  expect(r.status).toBe(500);
  expect(r.body).toEqual({ ok: false, message: expect.any(String) });
});

it('대표 이미지(kind=cover)는 16:9로 저장된다', async () => {
  const png = await makePng(1000, 1000);
  const r = await call([png], { projectId: 'p1', kind: 'cover' });

  expect(r.status).toBe(200);
  expect(r.body.url).toMatch(/w=1200&h=675$/);
});

it('Cache-Control: no-store가 실린다', async () => {
  const r = await call([], { projectId: 'p1', kind: 'body' }, 'GET');
  expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});
