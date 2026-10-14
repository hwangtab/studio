/** @jest-environment node */
import { Readable } from 'node:stream';

import sharp from 'sharp';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../../../tests/helpers/showsDb';
import { fundingCreators, showSubmissions } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

let mockDb: ShowsTestDb;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
const authenticate = jest.fn();
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorApi: (...a: unknown[]) => authenticate(...a) }));
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn(async () => true) }));
const put = jest.fn(async (..._args: unknown[]) => ({}));
jest.mock('@vercel/blob', () => ({ put: (...a: unknown[]) => put(...a) }));
jest.mock('../../../../lib/shows/organizer/email', () => ({
  notifyOperatorShowSubmitted: jest.fn(async () => {}),
  notifyOperatorShowEdited: jest.fn(async () => {}),
}));

/* eslint-disable import/first */
import showsHandler from '../../../../pages/api/funding/creator/shows';
import showHandler from '../../../../pages/api/funding/creator/shows/[id]';
import uploadHandler from '../../../../pages/api/funding/creator/shows/[id]/upload';
import withdrawHandler from '../../../../pages/api/funding/creator/shows/[id]/withdraw';
/* eslint-enable import/first */

const GOOD_ORIGIN = 'https://studionol.co.kr';

function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  opts: { method: string; query?: Record<string, string>; origin?: string | null; body?: unknown; raw?: Buffer },
) {
  const base = opts.raw ? Readable.from([opts.raw]) : Readable.from([]);
  const req = Object.assign(base, {
    method: opts.method,
    query: opts.query ?? {},
    headers: opts.origin === null ? {} : { origin: opts.origin ?? GOOD_ORIGIN },
    body: opts.body,
    socket: { remoteAddress: '203.0.113.1' },
  }) as unknown as NextApiRequest;
  const out: { status: number; json: Record<string, unknown> } = { status: 200, json: {} };
  const res = {
    setHeader: jest.fn(),
    status(code: number) { out.status = code; return this; },
    json(payload: Record<string, unknown>) { out.json = payload; return this; },
  } as unknown as NextApiResponse;
  return Promise.resolve(handler(req, res)).then(() => out);
}

async function seedCreator() {
  const [c] = await mockDb.insert(fundingCreators).values({ email: `c-${crypto.randomUUID()}@example.com`, name: '주최자' }).returning();
  return c.id;
}
const login = (creatorId: string | null) =>
  authenticate.mockResolvedValue(creatorId ? { ok: true, creatorId } : { ok: false });

beforeEach(async () => {
  ({ db: mockDb } = await createTestDb());
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('주최자 공연 API', () => {
  it('비로그인은 401', async () => {
    login(null);
    expect((await call(showsHandler, { method: 'GET' })).status).toBe(401);
    expect((await call(showsHandler, { method: 'POST' })).status).toBe(401);
  });

  it('잘못된 origin의 쓰기는 403, 로그인 검사 전에 막는다', async () => {
    login(await seedCreator());
    const r = await call(showsHandler, { method: 'POST', origin: 'https://evil.example' });
    expect(r.status).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('남의 id는 GET·PUT·withdraw·upload 모두 404', async () => {
    const a = await seedCreator();
    const b = await seedCreator();
    login(a);
    const { json } = await call(showsHandler, { method: 'POST' });
    const id = json.id as string;
    login(b);
    expect((await call(showHandler, { method: 'GET', query: { id } })).status).toBe(404);
    expect((await call(showHandler, { method: 'PUT', query: { id }, body: {} })).status).toBe(404);
    expect((await call(withdrawHandler, { method: 'POST', query: { id } })).status).toBe(404);
    expect((await call(uploadHandler, { method: 'POST', query: { id, kind: 'poster' }, raw: Buffer.from('x') })).status).toBe(404);
  });

  it('새로 만들면 목록에 보이고, 열린 신청서는 5개까지', async () => {
    const c = await seedCreator();
    login(c);
    for (let i = 0; i < 5; i += 1) expect((await call(showsHandler, { method: 'POST' })).status).toBe(200);
    const sixth = await call(showsHandler, { method: 'POST' });
    expect(sixth.status).toBe(400);
    const list = await call(showsHandler, { method: 'GET' });
    expect((list.json.submissions as unknown[]).length).toBe(5);
  });

  it('업로드: kind 오류 400, 심사 중 409, 성공 시 주소 반환', async () => {
    const c = await seedCreator();
    login(c);
    const id = (await call(showsHandler, { method: 'POST' })).json.id as string;
    const png = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#888' } }).png().toBuffer();

    expect((await call(uploadHandler, { method: 'POST', query: { id, kind: 'x' }, raw: png })).status).toBe(400);

    const ok = await call(uploadHandler, { method: 'POST', query: { id, kind: 'poster' }, raw: png });
    expect(ok.status).toBe(200);
    expect(ok.json.url).toMatch(new RegExp(`^/api/funding/media/${c}-[0-9a-f-]{36}\\.webp\\?w=40&h=60$`));
    expect(put).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^funding/${c}-`)), expect.any(Buffer), expect.objectContaining({ access: 'private' }));

    await mockDb.update(showSubmissions).set({ reviewStatus: 'submitted' }).where(eq(showSubmissions.id, id));
    expect((await call(uploadHandler, { method: 'POST', query: { id, kind: 'photo' }, raw: png })).status).toBe(409);
  });
});
