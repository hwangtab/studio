/** @jest-environment node */
/** 세션 연주자 등록 — 실 DB(in-memory libSQL)로: 등록·중복 이메일·횟수 제한·관리 링크·표 없음 503. 메일은 목. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn() }));

/* eslint-disable import/first */
import indexHandler from '../../pages/api/session-musicians/index';
import manageHandler from '../../pages/api/session-musicians/manage';
import { sendEmail } from '../email/resend';
import { FUNDING_TERMS_VERSION } from '../funding/policy';
import { openSessionPrivate } from './privateData';
import { hashManageToken } from './tokens';
/* eslint-enable import/first */

let client: Client;
const sendEmailMock = sendEmail as jest.Mock;

beforeAll(async () => {
  process.env.FUNDING_FIELD_KEY = randomBytes(32).toString('base64');
  process.env.ADMIN_SESSION_SECRET = 'test-secret-test-secret-test-secret-123';
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
  await client.execute('DELETE FROM rate_limits');
  jest.resetAllMocks();
  sendEmailMock.mockResolvedValue({ ok: true });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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

const call = async (
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  opts: { method?: string; body?: unknown; ip?: string; origin?: string | null; headers?: Record<string, string>; query?: Record<string, string> } = {},
) => {
  const { res, out } = makeRes();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-vercel-forwarded-for': opts.ip ?? '1.1.1.1',
    ...(opts.origin === null ? {} : { origin: opts.origin ?? 'https://studionol.co.kr' }),
    ...opts.headers,
  };
  const req = { method: opts.method ?? 'POST', headers, body: opts.body, query: opts.query ?? {}, socket: { remoteAddress: '' } } as unknown as NextApiRequest;
  await handler(req, res);
  return out;
};

const form = (over: Record<string, unknown> = {}) => ({
  stageName: '김베이스',
  realName: '김하늘',
  adultConfirmed: true,
  consent: true,
  primaryInstrument: 'bass',
  instruments: ['bass'],
  genres: ['jazz'],
  yearsExperience: 10,
  reading: 'chart',
  remoteRecording: true,
  region: '서울',
  bio: '소개',
  sampleLinks: [{ url: 'https://www.youtube.com/watch?v=abc', label: '영상' }],
  ratePerSong: '',
  rateNote: '',
  phone: '010-9999-8888',
  email: 'Player@Example.com',
  kakaoId: 'player1',
  company: '',
  _formFillMs: 20_000,
  ...over,
});

const rows = async () => (await client.execute('SELECT * FROM session_musicians')).rows as unknown as Array<Record<string, unknown>>;

/** 마지막 접수 확인·재발송 메일(고객 앞)에서 관리 토큰을 꺼낸다. */
const tokenFromMail = (): string => {
  const customerCall = sendEmailMock.mock.calls.map((c) => c[0]).filter((m) => m.to === 'player@example.com').pop();
  const match = /\/manage\/([0-9a-f]{64})/.exec(customerCall.text);
  if (!match) throw new Error('메일에서 관리 링크를 찾지 못했다');
  return match[1];
};

describe('POST /api/session-musicians', () => {
  it('등록하면 행이 생기고 개인정보는 암호문으로만 저장된다', async () => {
    const out = await call(indexHandler, { body: form() });
    expect(out).toEqual({ status: 200, body: { ok: true } });

    const [row] = await rows();
    expect(row.stage_name).toBe('김베이스');
    expect(row.status).toBe('new');
    expect(row.consent_version).toBe(FUNDING_TERMS_VERSION);
    expect(row.adult_confirmed).toBe(1);
    // 평문이 어느 칸에도 없다.
    const dump = JSON.stringify(row);
    for (const secret of ['김하늘', '010-9999-8888', 'player@example.com', 'Player@Example.com', 'player1']) expect(dump).not.toContain(secret);
    // 암호문은 열리고, 해시 두 칸은 원문이 아니다.
    expect(openSessionPrivate(String(row.private_enc))).toEqual({ realName: '김하늘', phone: '010-9999-8888', email: 'player@example.com', kakaoId: 'player1' });
    expect(String(row.email_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(row.manage_token_hash)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('곡당 희망 연주비는 쉼표 문자열도 정수로 저장하고, 비우면 null이며, 범위 밖이면 400', async () => {
    expect((await call(indexHandler, { body: form({ ratePerSong: '150,000' }) })).status).toBe(200);
    expect((await rows())[0].rate_per_song).toBe(150000);
    await client.execute('DELETE FROM session_musicians');
    expect((await call(indexHandler, { body: form({ ratePerSong: '' }) })).status).toBe(200);
    expect((await rows())[0].rate_per_song).toBeNull();
    await client.execute('DELETE FROM session_musicians');
    const bad = await call(indexHandler, { body: form({ ratePerSong: '9,999' }) });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ code: 'rate_per_song_invalid', field: 'ratePerSong' });
    expect(await rows()).toHaveLength(0);
  });

  it('관리 토큰은 해시만 저장되고 메일의 원문과 짝이 맞는다 — 소문자 hex라 미들웨어의 소문자 308에 깨지지 않는다', async () => {
    await call(indexHandler, { body: form() });
    const token = tokenFromMail();
    expect(token).toBe(token.toLowerCase());
    const [row] = await rows();
    expect(row.manage_token_hash).toBe(hashManageToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('메일은 둘 — 본인 확인 메일과 운영자 알림. 운영자 알림에는 연락처가 없다', async () => {
    await call(indexHandler, { body: form() });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const mails = sendEmailMock.mock.calls.map((c) => c[0]);
    const operator = mails.find((m) => m.to !== 'player@example.com');
    expect(operator.subject).toContain('김베이스');
    expect(operator.html).toContain('/admin/session-musicians/');
    for (const secret of ['010-9999-8888', 'player@example.com', 'player1', '김하늘']) {
      expect(operator.html).not.toContain(secret);
      expect(operator.text).not.toContain(secret);
    }
    const customer = mails.find((m) => m.to === 'player@example.com');
    expect(customer.text).not.toContain('소개');
  });

  it('같은 이메일(대소문자 달라도)이면 새 행을 만들지 않고 새 관리 링크를 보낸다 — 응답은 같다', async () => {
    const first = await call(indexHandler, { body: form() });
    const oldToken = tokenFromMail();
    sendEmailMock.mockClear();

    const second = await call(indexHandler, { body: form({ stageName: '다른이름', email: ' PLAYER@example.com ' }) });
    expect(second).toEqual(first);
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].stage_name).toBe('김베이스');

    const mails = sendEmailMock.mock.calls.map((c) => c[0]);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('player@example.com');
    expect(mails[0].subject).toContain('이미 등록');

    const newToken = tokenFromMail();
    expect(newToken).not.toBe(oldToken);
    expect((await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': oldToken } })).status).toBe(404);
    expect((await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': newToken } })).status).toBe(200);
  });

  it('허니팟·너무 빠른 제출은 가짜 200이고 아무것도 저장·발송하지 않는다', async () => {
    expect((await call(indexHandler, { body: form({ company: 'ACME' }) })).status).toBe(200);
    expect((await call(indexHandler, { body: form({ _formFillMs: 500 }) })).status).toBe(200);
    expect(await rows()).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('출처가 다르면 403', async () => {
    expect((await call(indexHandler, { body: form(), origin: 'https://evil.example' })).status).toBe(403);
    expect((await call(indexHandler, { body: form(), origin: null })).status).toBe(403);
    expect(await rows()).toHaveLength(0);
  });

  it('같은 이메일 재등록의 재발송 메일이 실패하면 옛 관리 링크가 그대로 살아 있다', async () => {
    await call(indexHandler, { body: form() });
    const oldToken = tokenFromMail();
    sendEmailMock.mockResolvedValue({ ok: false, errorCode: 'API_ERROR', errorDetail: 'boom' });

    expect((await call(indexHandler, { body: form() })).status).toBe(200);
    sendEmailMock.mockResolvedValue({ ok: true });
    expect((await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': oldToken } })).status).toBe(200);
  });

  it('재발송 메일이 응답 지연(TIMEOUT)이면 도착했을 수 있으니 새 링크를 살려 둔다', async () => {
    await call(indexHandler, { body: form() });
    sendEmailMock.mockClear();
    sendEmailMock.mockResolvedValue({ ok: false, errorCode: 'TIMEOUT' });
    expect((await call(indexHandler, { body: form() })).status).toBe(200);
    const newToken = tokenFromMail();
    sendEmailMock.mockResolvedValue({ ok: true });
    expect((await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': newToken } })).status).toBe(200);
  });

  it('등록이 서버 장애로 실패하면 IP 한도도 되돌린다 — 장애 뒤 한 시간 막히지 않는다', async () => {
    await client.execute('ALTER TABLE session_musicians RENAME COLUMN stage_name TO stage_name_x');
    try {
      for (let i = 0; i < 3; i += 1) expect((await call(indexHandler, { body: form({ email: `t${i}@example.com` }) })).status).toBe(500);
    } finally {
      await client.execute('ALTER TABLE session_musicians RENAME COLUMN stage_name_x TO stage_name');
    }
    expect((await call(indexHandler, { body: form() })).status).toBe(200);
  });

  it('검증에 걸리면 IP 한도도 쓰지 않는다 — 오타를 고쳐 다시 내는 지원자가 막히지 않는다', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await call(indexHandler, { body: form({ phone: '12' }) })).status).toBe(400);
    }
    expect((await call(indexHandler, { body: form() })).status).toBe(200);
  });

  it('검증에 걸리면 400이고 제한 예산을 쓰지 않는다', async () => {
    const out = await call(indexHandler, { body: form({ adultConfirmed: false }) });
    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({ ok: false, code: 'adult_required' });
    const limits = (await client.execute("SELECT key FROM rate_limits WHERE key LIKE 'session_musician:email:%' OR key = 'session_musician:global'")).rows;
    expect(limits).toHaveLength(0);
  });

  it('IP당 시간당 3건 — 네 번째는 429', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await call(indexHandler, { body: form({ email: `p${i}@example.com` }) })).status).toBe(200);
    }
    expect((await call(indexHandler, { body: form({ email: 'p9@example.com' }) })).status).toBe(429);
    // 다른 IP는 영향이 없다.
    expect((await call(indexHandler, { body: form({ email: 'p9@example.com' }), ip: '2.2.2.2' })).status).toBe(200);
  });

  it('이메일당 하루 2건 — 세 번째는 같은 200이지만 메일을 보내지 않는다', async () => {
    await call(indexHandler, { body: form() });
    await call(indexHandler, { body: form() });
    sendEmailMock.mockClear();
    const third = await call(indexHandler, { body: form() });
    expect(third).toEqual({ status: 200, body: { ok: true } });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('전체 하루 50건 상한 — 넘으면 429이고 저장하지 않는다', async () => {
    await client.execute({ sql: 'INSERT INTO rate_limits (key, count, expires_at) VALUES (?, ?, ?)', args: ['session_musician:global', 50, Math.floor(Date.now() / 1000) + 3600] });
    const out = await call(indexHandler, { body: form() });
    expect(out.status).toBe(429);
    expect(out.body).toMatchObject({ code: 'daily_cap' });
    expect(await rows()).toHaveLength(0);
  });

  it('전체 상한에 걸린 요청은 이메일 한도를 쓰지 않는다 — 재시도가 가짜 200을 받지 않는다', async () => {
    await client.execute({ sql: 'INSERT INTO rate_limits (key, count, expires_at) VALUES (?, ?, ?)', args: ['session_musician:global', 50, Math.floor(Date.now() / 1000) + 3600] });
    for (const ip of ['5.5.5.1', '5.5.5.2', '5.5.5.3']) {
      expect((await call(indexHandler, { body: form(), ip })).body).toMatchObject({ code: 'daily_cap' });
    }
    const emailRows = (await client.execute("SELECT count FROM rate_limits WHERE key LIKE 'session_musician:email:%'")).rows;
    expect(emailRows.every((row) => Number(row.count) === 0)).toBe(true);
  });

  it('등록이 DB 장애로 실패하면 이메일·전체 한도를 되돌린다 — 다시 시도한 지원자가 가짜 성공을 보지 않는다', async () => {
    await client.execute('ALTER TABLE session_musicians RENAME COLUMN stage_name TO stage_name_x');
    try {
      expect((await call(indexHandler, { body: form() })).status).toBe(500);
      expect((await call(indexHandler, { body: form(), ip: '3.3.3.3' })).status).toBe(500);
    } finally {
      await client.execute('ALTER TABLE session_musicians RENAME COLUMN stage_name_x TO stage_name');
    }
    const counts = (await client.execute("SELECT key, count FROM rate_limits WHERE key LIKE 'session_musician:email:%' OR key = 'session_musician:global'")).rows;
    expect(counts.every((row) => Number(row.count) === 0)).toBe(true);

    // 장애가 끝난 뒤 세 번째 시도는 실제로 저장된다(예전엔 이메일 한도에 걸려 저장 없이 200이었다).
    expect((await call(indexHandler, { body: form(), ip: '4.4.4.4' })).status).toBe(200);
    expect(await rows()).toHaveLength(1);
  });

  it('메일 발송이 실패해도 접수는 남는다', async () => {
    sendEmailMock.mockResolvedValue({ ok: false, errorCode: 'API_ERROR', errorDetail: 'boom' });
    const out = await call(indexHandler, { body: form() });
    expect(out.status).toBe(200);
    expect(await rows()).toHaveLength(1);
  });

  it('POST 외 메서드는 405', async () => {
    expect((await call(indexHandler, { method: 'GET' })).status).toBe(405);
  });
});

describe('/api/session-musicians/manage', () => {
  const register = async () => {
    await call(indexHandler, { body: form() });
    return tokenFromMail();
  };

  it('GET은 헤더 토큰으로만 열린다 — 쿼리의 token은 읽지 않는다', async () => {
    const token = await register();
    const viaQuery = await call(manageHandler, { method: 'GET', query: { token } });
    expect(viaQuery.status).toBe(404);
    const ok = await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': token } });
    expect(ok.status).toBe(200);
    const profile = ok.body.profile as Record<string, unknown>;
    expect(profile.stageName).toBe('김베이스');
    expect(profile.private).toMatchObject({ realName: '김하늘', phone: '010-9999-8888', email: 'player@example.com' });
    // 운영자만 아는 칸은 본인 화면에 없다.
    expect(profile).not.toHaveProperty('status');
    expect(profile).not.toHaveProperty('operatorMemo');
  });

  it('틀린 토큰·형식이 아닌 토큰은 같은 404', async () => {
    await register();
    const wrong = await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': 'a'.repeat(64) } });
    const malformed = await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': 'short' } });
    const missing = await call(manageHandler, { method: 'GET' });
    expect([wrong.status, malformed.status, missing.status]).toEqual([404, 404, 404]);
    expect(wrong.body).toEqual(malformed.body);
  });

  it('PATCH는 내용을 고치고 이메일은 못 바꾸며 보유 기간 기산점을 갱신한다', async () => {
    const token = await register();
    await client.execute("UPDATE session_musicians SET last_confirmed_at = 1000, reconfirm_sent_at = 1000, status = 'reviewed'");
    const out = await call(manageHandler, {
      method: 'PATCH',
      headers: { 'x-manage-token': token },
      body: form({ stageName: '새이름', email: 'hacker@example.com', adultConfirmed: undefined, consent: undefined, phone: '010-1111-2222' }),
    });
    expect(out.status).toBe(200);
    const [row] = await rows();
    expect(row.stage_name).toBe('새이름');
    expect(Number(row.last_confirmed_at)).toBeGreaterThan(1000);
    expect(row.reconfirm_sent_at).toBeNull();
    expect(row.status).toBe('reviewed'); // 운영자 상태는 본인 수정이 건드리지 않는다
    expect(openSessionPrivate(String(row.private_enc))).toMatchObject({ phone: '010-1111-2222', email: 'player@example.com' });
  });

  it('PATCH는 곡당 희망 연주비를 바꾸고 GET이 숫자로 돌려준다 — 비우면 지워진다', async () => {
    const token = await register();
    const patch = (ratePerSong: unknown) =>
      call(manageHandler, {
        method: 'PATCH',
        headers: { 'x-manage-token': token },
        body: form({ ratePerSong, adultConfirmed: undefined, consent: undefined }),
      });
    expect((await patch('200,000')).status).toBe(200);
    expect((await rows())[0].rate_per_song).toBe(200000);
    const got = await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': token } });
    expect((got.body.profile as Record<string, unknown>).ratePerSong).toBe(200000);
    expect((await patch('')).status).toBe(200);
    expect((await rows())[0].rate_per_song).toBeNull();
    expect((await patch(5)).body).toMatchObject({ code: 'rate_per_song_invalid' });
  });

  it('PATCH 검증 실패는 400', async () => {
    const token = await register();
    const out = await call(manageHandler, { method: 'PATCH', headers: { 'x-manage-token': token }, body: form({ sampleLinks: [] }) });
    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({ code: 'sample_links_required' });
  });

  it('POST confirm은 보유 기간 기산점만 갱신한다', async () => {
    const token = await register();
    await client.execute('UPDATE session_musicians SET last_confirmed_at = 1000, reconfirm_sent_at = 1000');
    const out = await call(manageHandler, { method: 'POST', headers: { 'x-manage-token': token }, body: { action: 'confirm' } });
    expect(out.status).toBe(200);
    const [row] = await rows();
    expect(Number(row.last_confirmed_at)).toBeGreaterThan(1000);
    expect(row.reconfirm_sent_at).toBeNull();
    expect(row.stage_name).toBe('김베이스');
  });

  it('DELETE는 행을 즉시 지운다 — 두 번째는 404', async () => {
    const token = await register();
    expect((await call(manageHandler, { method: 'DELETE', headers: { 'x-manage-token': token } })).status).toBe(200);
    expect(await rows()).toHaveLength(0);
    expect((await call(manageHandler, { method: 'DELETE', headers: { 'x-manage-token': token } })).status).toBe(404);
  });

  it('상태를 바꾸는 요청은 출처가 다르면 403', async () => {
    const token = await register();
    const out = await call(manageHandler, { method: 'DELETE', headers: { 'x-manage-token': token }, origin: 'https://evil.example' });
    expect(out.status).toBe(403);
    expect(await rows()).toHaveLength(1);
  });
});

describe('표가 없는 DB(마이그레이션 0077 전)', () => {
  it('등록 API와 관리 API는 503 migration_needed', async () => {
    await client.execute('DROP TABLE session_musicians');
    const registered = await call(indexHandler, { body: form() });
    expect(registered.status).toBe(503);
    expect(registered.body).toMatchObject({ code: 'migration_needed' });
    const managed = await call(manageHandler, { method: 'GET', headers: { 'x-manage-token': 'a'.repeat(64) } });
    expect(managed.status).toBe(503);
  });
});
