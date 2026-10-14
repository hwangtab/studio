/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

jest.mock('../../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn() }));
jest.mock('../../../../lib/funding/businessStatus', () => ({
  ...jest.requireActual('../../../../lib/funding/businessStatus'),
  lookupBusinessStatus: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../../../db/schema';
import { getDb } from '../../../../db/client';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { lookupBusinessStatus } from '../../../../lib/funding/businessStatus';
import handler from '../../../../pages/api/admin/creators/[creatorId]/tax-profile';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let db: ReturnType<typeof drizzle<typeof schema>>;

const call = async (method: string, creatorId: unknown, body?: unknown) => {
  const out: { status: number; json: Record<string, unknown> } = { status: 0, json: {} };
  const res = {
    setHeader: jest.fn(),
    status(code: number) { out.status = code; return this; },
    json(v: Record<string, unknown>) { out.json = v; return this; },
  } as unknown as NextApiResponse;
  await handler({ method, query: { creatorId }, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return out;
};

const seedCreator = async (taxType: 'withholding' | 'invoice' | null): Promise<string> => {
  const [creator] = await db.insert(schema.fundingCreators)
    .values({ email: 'biz@example.com', name: '가나', taxType, payoutAccountLast4: '1234' }).returning();
  return creator.id;
};

const seedBusiness = async (creatorId: string) => {
  await db.insert(schema.creatorBusinessProfiles).values({
    creatorId,
    businessNumber: '1234567891',
    businessName: '가나 스튜디오',
    representativeName: '홍길동',
    certificateKey: `tax-docs/${creatorId}/a.pdf`,
    certificateContentType: 'application/pdf',
    certificateUploadedAt: new Date('2026-10-01T00:00:00Z'),
  });
};

beforeEach(async () => {
  jest.clearAllMocks();
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  db = drizzle(client, { schema });
  (getDb as jest.Mock).mockReturnValue(db);
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha' });
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
});

afterEach(() => client.close());

test('무인증 401', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  expect((await call('GET', 'x')).status).toBe(401);
});

test('creatorId가 문자열이 아니면 400', async () => {
  expect((await call('GET', ['a', 'b'])).status).toBe(400);
});

test('개설자가 없으면 404', async () => {
  expect((await call('GET', 'nope')).status).toBe(404);
});

test('GET — 세금 구분과 사업자 요약만 싣는다(계좌·Blob 경로 없음)', async () => {
  const id = await seedCreator('invoice');
  await seedBusiness(id);
  const r = await call('GET', id);
  expect(r.status).toBe(200);
  expect(r.json.taxType).toBe('invoice');
  expect(r.json.business).toMatchObject({
    businessNumber: '1234567891',
    businessName: '가나 스튜디오',
    representativeName: '홍길동',
    ntsStatus: 'unverified',
    ntsCheckError: null,
    hasCertificate: true,
  });
  const text = JSON.stringify(r.json);
  expect(text).not.toContain('tax-docs/');
  expect(text).not.toContain('1234"');
  expect(text).not.toMatch(/payoutAccount|residentNumber|certificateKey/);
});

test('GET — 원천징수 개설자는 business null', async () => {
  const id = await seedCreator('withholding');
  const r = await call('GET', id);
  expect(r.status).toBe(200);
  expect(r.json).toMatchObject({ taxType: 'withholding', business: null, businessUnavailable: false });
});

describe('POST recheck', () => {
  test('조회 성공이면 상태가 갱신된다', async () => {
    const id = await seedCreator('invoice');
    await seedBusiness(id);
    (lookupBusinessStatus as jest.Mock).mockResolvedValue({ ok: true, status: 'active', taxTypeCode: '01', taxTypeLabel: '부가가치세 일반과세자' });
    const r = await call('POST', id, { action: 'recheck' });
    expect(r.status).toBe(200);
    expect(lookupBusinessStatus).toHaveBeenCalledWith('1234567891');
    const [row] = await db.select().from(schema.creatorBusinessProfiles).where(eq(schema.creatorBusinessProfiles.creatorId, id));
    expect(row).toMatchObject({ ntsStatus: 'active', ntsTaxTypeCode: '01', ntsCheckError: null });
    expect(row.ntsCheckedAt).toBeInstanceOf(Date);
    expect(r.json.business).toMatchObject({ ntsStatus: 'active', ntsTaxTypeLabel: '부가가치세 일반과세자' });
  });

  test('조회 실패면 unverified + 사유 코드', async () => {
    const id = await seedCreator('invoice');
    await seedBusiness(id);
    await db.update(schema.creatorBusinessProfiles).set({ ntsStatus: 'active', ntsTaxTypeCode: '01' })
      .where(eq(schema.creatorBusinessProfiles.creatorId, id));
    (lookupBusinessStatus as jest.Mock).mockResolvedValue({ ok: false, error: 'timeout' });
    const r = await call('POST', id, { action: 'recheck' });
    expect(r.status).toBe(200);
    const [row] = await db.select().from(schema.creatorBusinessProfiles).where(eq(schema.creatorBusinessProfiles.creatorId, id));
    expect(row).toMatchObject({ ntsStatus: 'unverified', ntsTaxTypeCode: null, ntsCheckError: 'timeout' });
  });

  test('사업자 행이 없으면 404이고 조회하지 않는다', async () => {
    const id = await seedCreator('withholding');
    expect((await call('POST', id, { action: 'recheck' })).status).toBe(404);
    expect(lookupBusinessStatus).not.toHaveBeenCalled();
  });

  test('요청 제한을 넘으면 429이고 조회하지 않는다', async () => {
    const id = await seedCreator('invoice');
    await seedBusiness(id);
    (consumeRateLimit as jest.Mock).mockResolvedValue(false);
    expect((await call('POST', id, { action: 'recheck' })).status).toBe(429);
    expect(lookupBusinessStatus).not.toHaveBeenCalled();
  });

  test('action이 recheck가 아니면 400', async () => {
    const id = await seedCreator('invoice');
    expect((await call('POST', id, { action: 'other' })).status).toBe(400);
  });
});

test('그 밖의 메서드는 405', async () => {
  expect((await call('DELETE', 'x')).status).toBe(405);
});
