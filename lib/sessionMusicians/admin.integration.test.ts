/** @jest-environment node */
/** 세션 연주자 관리자 API — 연락처 열람은 접속기록에 남고, 상태·메모·삭제가 동작하며, 인증 없이는 401. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));

/* eslint-disable import/first */
import detailHandler from '../../pages/api/admin/session-musicians/[id]/index';
import privateHandler from '../../pages/api/admin/session-musicians/[id]/private';
import { authenticateAdminApi } from '../contracts/admin-auth';
import { sealSessionPrivate } from './privateData';
import { countNewSessionMusicians, insertSessionMusician, listSessionMusicians, parseSessionMusicianSort, toProfile, getSessionMusician } from './repository';
/* eslint-enable import/first */

let client: Client;
const authMock = authenticateAdminApi as jest.Mock;

beforeAll(async () => {
  process.env.FUNDING_FIELD_KEY = randomBytes(32).toString('base64');
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(path.join(process.cwd(), 'drizzle/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(process.cwd(), 'drizzle/migrations', file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.execute('DELETE FROM session_musicians');
  await client.execute('DELETE FROM privacy_access_logs');
  jest.resetAllMocks();
  authMock.mockResolvedValue({ ok: true, actor: 'kyungha' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const makeRes = () => {
  const out: { status: number; body: Record<string, unknown> } = { status: 200, body: {} };
  const res = {
    setHeader: () => res,
    status(code: number) {
      out.status = code;
      return res;
    },
    json(payload: Record<string, unknown>) {
      out.body = payload;
      return res;
    },
  } as unknown as NextApiResponse;
  return { res, out };
};

const call = async (handler: (req: NextApiRequest, res: NextApiResponse) => unknown, method: string, id: string, body?: unknown) => {
  const { res, out } = makeRes();
  await handler({ method, query: { id }, body, headers: {}, socket: { remoteAddress: '9.9.9.9' } } as unknown as NextApiRequest, res);
  return out;
};

const seed = async (stageName = '김베이스', email = 'player@example.com', ratePerSong: number | null = null) =>
  insertSessionMusician({
    input: {
      stageName, realName: '김하늘', primaryInstrument: 'bass', instruments: ['bass', { other: '우쿨렐레' }], genres: ['jazz'], yearsExperience: 5,
      reading: 'chart', remoteRecording: true, region: '서울', bio: '소개', sampleLinks: [{ url: 'https://example.org/a', label: '' }], ratePerSong, rateNote: null,
      phone: '010-1111-2222', email, kakaoId: 'k1',
    },
    privateEnc: sealSessionPrivate({ realName: '김하늘', phone: '010-1111-2222', email, kakaoId: 'k1' }),
    emailHash: `hash-${email}`,
    manageTokenHash: `token-${email}`,
    consentVersion: 'test',
  });

describe('연락처 열람', () => {
  it('복호화한 값을 응답으로만 주고 접속기록(session_musician_private_view)에 남긴다 — 값은 적지 않는다', async () => {
    const id = await seed();
    const out = await call(privateHandler, 'GET', id);
    expect(out.status).toBe(200);
    expect(out.body.private).toEqual({ realName: '김하늘', phone: '010-1111-2222', email: 'player@example.com', kakaoId: 'k1' });

    const logs = (await client.execute('SELECT * FROM privacy_access_logs')).rows as unknown as Array<Record<string, unknown>>;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'session_musician_private_view', target_id: id, result: 'success', actor: 'kyungha' });
    expect(JSON.stringify(logs[0])).not.toContain('010-1111-2222');
  });

  it('없는 id는 404이고 not_found로 기록한다', async () => {
    const out = await call(privateHandler, 'GET', 'nope');
    expect(out.status).toBe(404);
    const logs = (await client.execute('SELECT result FROM privacy_access_logs')).rows;
    expect(logs[0].result).toBe('not_found');
  });

  it('키가 틀려 복호화에 실패하면 500이고 decrypt_failed로 기록한다', async () => {
    const id = await seed();
    process.env.FUNDING_FIELD_KEY = randomBytes(32).toString('base64');
    const out = await call(privateHandler, 'GET', id);
    expect(out.status).toBe(500);
    const logs = (await client.execute('SELECT result FROM privacy_access_logs')).rows;
    expect(logs[0].result).toBe('decrypt_failed');
  });

  it('인증이 없으면 401이고 아무것도 열지 않는다', async () => {
    const id = await seed();
    authMock.mockResolvedValue({ ok: false });
    expect((await call(privateHandler, 'GET', id)).status).toBe(401);
    expect((await client.execute('SELECT * FROM privacy_access_logs')).rows).toHaveLength(0);
  });
});

describe('상태·메모·삭제', () => {
  it('상태와 메모를 바꾼다 — 본인 입력은 건드리지 않는다', async () => {
    const id = await seed();
    const out = await call(detailHandler, 'PATCH', id, { status: 'active', operatorMemo: '  다음 녹음에 연락  ' });
    expect(out.status).toBe(200);
    const row = (await getSessionMusician(id))!;
    expect(row.status).toBe('active');
    expect(row.operatorMemo).toBe('다음 녹음에 연락');
    expect(row.stageName).toBe('김베이스');
  });

  it('잘못된 상태는 400', async () => {
    const id = await seed();
    expect((await call(detailHandler, 'PATCH', id, { status: 'hired' })).status).toBe(400);
    expect((await call(detailHandler, 'PATCH', id, {})).status).toBe(400);
  });

  it('DELETE는 행을 지우고 누가 지웠는지 접속기록(session_musician_delete)에 남긴다', async () => {
    const id = await seed();
    expect((await call(detailHandler, 'DELETE', id)).status).toBe(200);
    expect(await getSessionMusician(id)).toBeNull();
    expect((await call(detailHandler, 'DELETE', id)).status).toBe(404);

    const logs = (await client.execute('SELECT action, target_id, result, actor FROM privacy_access_logs ORDER BY rowid')).rows;
    expect(logs.map((row) => ({ action: row.action, target_id: row.target_id, result: row.result, actor: row.actor }))).toEqual([
      { action: 'session_musician_delete', target_id: id, result: 'success', actor: 'kyungha' },
      { action: 'session_musician_delete', target_id: id, result: 'not_found', actor: 'kyungha' },
    ]);
  });

  it('인증이 없으면 401', async () => {
    const id = await seed();
    authMock.mockResolvedValue({ ok: false });
    expect((await call(detailHandler, 'PATCH', id, { status: 'active' })).status).toBe(401);
    expect((await call(detailHandler, 'DELETE', id)).status).toBe(401);
    expect(await getSessionMusician(id)).not.toBeNull();
  });
});

describe('목록 조회', () => {
  it('프로필에는 연락처가 없고(직렬화 가능한 숫자 시각), 악기·장르·원격·상태로 거른다', async () => {
    const a = await seed('기타리스트', 'a@example.com');
    await seed('드러머', 'b@example.com');
    await client.execute({ sql: "UPDATE session_musicians SET primary_instrument = 'drums', instruments_json = '[\"drums\"]', genres_json = '[\"rock\"]', remote_recording = 0, status = 'reviewed' WHERE stage_name = '드러머'", args: [] });

    const all = await listSessionMusicians();
    expect(all).toHaveLength(2);
    expect(JSON.stringify(all)).not.toMatch(/010-1111-2222|player@example|김하늘/);
    expect(typeof all[0].createdAt).toBe('number');

    expect((await listSessionMusicians({ instrument: 'drums' })).map((p) => p.stageName)).toEqual(['드러머']);
    expect((await listSessionMusicians({ instrument: 'upright-bass' }))).toHaveLength(0);
    expect((await listSessionMusicians({ genre: 'jazz' })).map((p) => p.id)).toEqual([a]);
    expect((await listSessionMusicians({ remoteOnly: true })).map((p) => p.id)).toEqual([a]);
    expect((await listSessionMusicians({ status: 'reviewed' })).map((p) => p.stageName)).toEqual(['드러머']);
    expect(toProfile((await getSessionMusician(a))!).instruments).toEqual(['bass', { other: '우쿨렐레' }]);
    expect(await countNewSessionMusicians()).toBe(1);
  });

  it('ratePerSong을 저장해 프로필로 돌려준다 — 미기재는 null', async () => {
    const withRate = await seed('연주비있음', 'rate@example.com', 150000);
    const without = await seed('연주비없음', 'none@example.com');
    expect(toProfile((await getSessionMusician(withRate))!).ratePerSong).toBe(150000);
    expect(toProfile((await getSessionMusician(without))!).ratePerSong).toBeNull();
  });

  it('sort=rate는 곡당 연주비 낮은 순이고 미기재는 맨 뒤 — 기본은 최신순', async () => {
    await seed('비쌈', 'a@example.com', 300000);
    await seed('미기재1', 'b@example.com');
    await seed('쌈', 'c@example.com', 80000);
    await seed('중간', 'd@example.com', 150000);
    await seed('미기재2', 'e@example.com');
    // createdAt 이 같은 초에 몰려도 최신순이 흔들리지 않게 명시한다.
    for (const [name, at] of [['비쌈', 1000], ['미기재1', 2000], ['쌈', 3000], ['중간', 4000], ['미기재2', 5000]] as const) {
      await client.execute({ sql: 'UPDATE session_musicians SET created_at = ? WHERE stage_name = ?', args: [at, name] });
    }
    const byRate = (await listSessionMusicians({ sort: 'rate' })).map((p) => p.stageName);
    expect(byRate).toEqual(['쌈', '중간', '비쌈', '미기재2', '미기재1']);
    const newest = (await listSessionMusicians()).map((p) => p.stageName);
    expect(newest).toEqual(['미기재2', '중간', '쌈', '미기재1', '비쌈']);
    expect((await listSessionMusicians({ sort: 'newest' })).map((p) => p.stageName)).toEqual(newest);
  });

  it('정렬 쿼리는 고정 목록의 값만 받는다', () => {
    expect(parseSessionMusicianSort('rate')).toBe('rate');
    expect(parseSessionMusicianSort('newest')).toBe('newest');
    for (const bad of ['', 'price', 'rate; DROP TABLE', undefined, ['rate'], 1]) expect(parseSessionMusicianSort(bad)).toBe('newest');
  });
});
