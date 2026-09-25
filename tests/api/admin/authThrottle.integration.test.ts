/** @jest-environment node */

/**
 * 로그인 시도 제한을 **라우트와 실제 카운터를 함께** 돌려 확인한다.
 *
 * 라우트 단위 테스트는 제한 모듈을 목으로 세우므로 "몇 번째부터 막히는가"를 못 본다.
 * 그런데 이 경로에서 실제로 지켜야 하는 성질이 바로 그 숫자다 — 시도 횟수를 끊는 것은
 * 비밀번호 대조 **앞**에 있는 IP 한도 하나뿐이고, 그 앞단이 사라지면 공격자는 429를
 * 받으면서 무한히 추측할 수 있다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));

// 비밀번호 대조만 목으로 세운다 — 카운터는 진짜를 쓴다.
jest.mock('../../../lib/contracts/admin-auth', () => ({
  loginAdminSession: jest.fn(),
  logoutAdminSession: jest.fn(),
  authenticateAdminApi: jest.fn(),
}));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';

import { loginAdminSession } from '../../../lib/contracts/admin-auth';
import handler from '../../../pages/api/admin/auth';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

/** `admin-rate-limit.ts`의 IP당 LIMIT. 이 숫자가 바뀌면 여기도 함께 움직여야 한다. */
const LIMIT = 30;

const IP = '203.0.113.7';

const post = async () => {
  const status = jest.fn().mockReturnValue({ json: jest.fn() });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler(
    {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': IP },
      query: {},
      socket: {},
    } as unknown as NextApiRequest,
    res,
  );
  return status.mock.calls[0][0] as number;
};

const wrongPassword = () => (loginAdminSession as jest.Mock).mockResolvedValue({ ok: false });
const rightPassword = () =>
  (loginAdminSession as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  client.close();
  jest.restoreAllMocks();
});

it(`오답 ${LIMIT}번까지는 401이고 ${LIMIT + 1}번째부터 429`, async () => {
  wrongPassword();
  for (let i = 1; i <= LIMIT; i += 1) {
    expect(await post()).toBe(401);
  }
  expect(await post()).toBe(429);
  expect(await post()).toBe(429);
});

/**
 * **이 파일의 요점.** 한도에 걸린 뒤에는 비밀번호가 맞아도 대조가 일어나지 않는다.
 * 대조가 한도보다 먼저 오면 맞힌 요청은 오답이 아니라 한도에 안 걸리고 통과한다 —
 * 그러면 시도 횟수를 끊는 장치가 아무것도 남지 않는다.
 */
it('한도에 걸린 뒤에는 올바른 비밀번호도 대조되지 않는다', async () => {
  wrongPassword();
  for (let i = 1; i <= LIMIT; i += 1) await post();

  rightPassword();
  (loginAdminSession as jest.Mock).mockClear();
  expect(await post()).toBe(429);
  expect(loginAdminSession).not.toHaveBeenCalled();
});

it('성공하면 카운터가 비워져 다시 처음부터 여유가 생긴다', async () => {
  wrongPassword();
  for (let i = 1; i <= LIMIT - 1; i += 1) await post();

  rightPassword();
  expect(await post()).toBe(200);

  wrongPassword();
  for (let i = 1; i <= LIMIT; i += 1) {
    expect(await post()).toBe(401);
  }
  expect(await post()).toBe(429);
});
