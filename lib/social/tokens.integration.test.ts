/** @jest-environment node */
/**
 * 토큰 갱신이 "만료된 뒤에는 연장 불가"라는 유일한 실패 모드를 실제로 막는지, 실제
 * SQLite(in-memory)와 가짜 Meta 응답으로 검증한다. 판정 실수는 조용히 토큰을 죽이고 결과는
 * 60일 뒤 브라우저 재승인이다 — 그래서 각 분기를 따로 고정한다.
 */
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from '../../db/schema';
import { REFRESH_WHEN_DAYS_LEFT, formatOutcomes, needsAttention, refreshAll, refreshPlatform } from './tokens';

let client: Client;
let db: ReturnType<typeof drizzle<typeof schema>>;
const NOW = Date.parse('2026-09-10T00:00:00Z');
const sec = (ms: number) => Math.floor(ms / 1000);
const DAY = 86_400_000;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  db = drizzle(client, { schema });
  const dir = path.join(process.cwd(), 'drizzle/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});
beforeEach(async () => {
  await client.execute('DELETE FROM social_tokens');
  global.fetch = jest.fn();
});
afterAll(() => client.close());

const seed = (platform: 'ig' | 'threads', daysLeft: number, ageDays = 10) =>
  db.insert(schema.socialTokens).values({
    platform,
    accessToken: `old-${platform}`,
    expiresAt: sec(NOW + daysLeft * DAY),
    updatedAt: sec(NOW - ageDays * DAY),
  });

const metaOk = () =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'new-token', expires_in: 60 * 86400 }),
  });

describe('refreshPlatform', () => {
  it('leaves a healthy token alone', async () => {
    await seed('ig', 45);
    const o = await refreshPlatform('ig', { db, now: NOW });
    expect(o.status).toBe('skipped');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refreshes once inside the threshold and stores the new token + expiry', async () => {
    await seed('threads', REFRESH_WHEN_DAYS_LEFT - 1);
    metaOk();
    const o = await refreshPlatform('threads', { db, now: NOW });
    expect(o).toMatchObject({ status: 'refreshed', daysLeft: 60 });
    const row = await db.query.socialTokens.findFirst();
    expect(row?.accessToken).toBe('new-token');
    expect(row?.expiresAt).toBe(sec(NOW) + 60 * 86400);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('graph.threads.net');
  });

  it('does not try to refresh a token younger than 24h (Meta rejects it)', async () => {
    await seed('ig', 5, 0.5);
    const o = await refreshPlatform('ig', { db, now: NOW });
    expect(o.status).toBe('skipped');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports expired without calling Meta — only re-auth can fix it', async () => {
    await seed('ig', -1);
    const o = await refreshPlatform('ig', { db, now: NOW });
    expect(o.status).toBe('expired');
    expect(needsAttention(o)).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the old token when Meta errors, and flags it', async () => {
    await seed('threads', 3);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 400, json: async () => ({ error: { message: 'boom', code: 190 } }),
    });
    const o = await refreshPlatform('threads', { db, now: NOW });
    expect(o).toMatchObject({ status: 'failed', error: 'boom' });
    expect((await db.query.socialTokens.findFirst())?.accessToken).toBe('old-threads');
  });

  it('reports missing rows', async () => {
    expect((await refreshPlatform('ig', { db, now: NOW })).status).toBe('missing');
  });
});

describe('refreshAll + formatOutcomes', () => {
  it('covers both platforms and renders one line each', async () => {
    await seed('ig', 45);
    await seed('threads', 2);
    metaOk();
    const outs = await refreshAll({ db, now: NOW });
    expect(outs.map((o) => o.status)).toEqual(['skipped', 'refreshed']);
    expect(outs.some(needsAttention)).toBe(false);
    expect(formatOutcomes(outs).split('\n')).toHaveLength(2);
  });
});
