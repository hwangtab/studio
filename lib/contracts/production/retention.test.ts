/** @jest-environment node */

/**
 * 제작 계약 개인정보 파기(계약서 제13조 3항 — 끝난 날부터 3년). 실제 SQLite에서 대상 선정과 지우는 범위를 본다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let client: Client;
let mockDb: ReturnType<typeof drizzle<typeof schema>>;
const mockDel = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('@vercel/blob', () => ({ del: (...args: unknown[]) => mockDel(...args) }));

import { purgeExpiredProductionPersonalData } from './retention';
import { canonicalTermsJson, buildDefaultProductionTerms, parseStoredTerms } from './terms';

const NOW = new Date('2030-06-01T00:00:00Z');
const OLD = new Date('2026-01-01T00:00:00Z'); // 3년 넘게 지났다
const RECENT = new Date('2029-01-01T00:00:00Z'); // 아직 3년이 안 됐다

const seed = async (
  id: string,
  status: schema.ProductionContractStatus,
  dates: { completedAt?: Date; terminatedAt?: Date; updatedAt?: Date; createdAt?: Date },
) => {
  const terms = { ...buildDefaultProductionTerms(), songs: [{ title: '미공개 곡' }] };
  await mockDb.insert(schema.productionContracts).values({
    id,
    kind: 'single',
    status,
    title: '홍길동님 계약',
    clientName: '홍길동',
    clientStageName: '길동밴드',
    clientEmail: 'g@example.com',
    clientPhone: '010-1234-5678',
    clientBirthdate: '1990-05-15',
    clientAddress: '서울시',
    termsJson: canonicalTermsJson(terms),
    totalAmount: terms.amount.total,
    clausesJson: '[]',
    template: 't',
    templateHash: 'h',
    content: '홍길동 본문',
    pdfUrl: `production-contracts/${id}.pdf`,
    completedAt: dates.completedAt,
    terminatedAt: dates.terminatedAt,
    terminationReason: dates.terminatedAt ? '홍길동 사정' : null,
    createdAt: dates.createdAt ?? OLD,
    updatedAt: dates.updatedAt ?? OLD,
  });
  await mockDb.insert(schema.productionContractSigners).values([
    { contractId: id, role: 'operator', name: '스튜디오 놀 대표 황경하', email: 'hello@studionol.co.kr', status: 'signed', ipAddress: '198.51.100.1' },
    { contractId: id, role: 'client', name: '홍길동', email: 'g@example.com', status: 'signed', ipAddress: '203.0.113.7', signatureData: 'data:x' },
  ]);
};

const load = (id: string) =>
  mockDb.query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id), with: { signers: true } });

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(path.join(process.cwd(), 'drizzle/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    const text = readFileSync(path.join(process.cwd(), 'drizzle/migrations', file), 'utf-8');
    for (const statement of text.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.execute(statement.trim());
    }
  }
});

afterAll(() => client.close());

beforeEach(async () => {
  mockDel.mockClear();
  await client.execute('DELETE FROM production_contract_signers');
  await client.execute('DELETE FROM production_contracts');
});

describe('제작 계약 개인정보 파기', () => {
  it('끝난 지 3년이 지난 계약만 파기한다 — 진행 중(signed)은 기간과 무관하게 남긴다', async () => {
    await seed('done-old', 'completed', { completedAt: OLD });
    await seed('done-recent', 'completed', { completedAt: RECENT });
    await seed('terminated-old', 'terminated', { terminatedAt: OLD });
    await seed('cancelled-old', 'cancelled', { updatedAt: OLD });
    await seed('in-progress', 'signed', {});

    const result = await purgeExpiredProductionPersonalData(NOW);
    expect(result).toEqual({ purged: 3, failed: 0 });
    expect((await load('done-recent'))?.purgedAt).toBeNull();
    expect((await load('in-progress'))?.purgedAt).toBeNull();
  });

  it('의뢰인을 가리키는 값과 PDF를 지우고, 금액·날짜는 남긴다', async () => {
    await seed('c1', 'terminated', { terminatedAt: OLD });
    await purgeExpiredProductionPersonalData(NOW);

    const purged = await load('c1');
    expect(mockDel).toHaveBeenCalledWith('production-contracts/c1.pdf');
    expect(purged).toMatchObject({
      clientName: '(개인정보 파기됨)',
      clientStageName: null,
      clientBirthdate: null,
      clientAddress: null,
      content: '(개인정보 파기됨)',
      terminationReason: null,
      pdfUrl: null,
      totalAmount: 1_150_000,
    });
    expect(parseStoredTerms(purged!.termsJson).songs).toEqual([{ title: null }]);
    expect(purged?.terminatedAt?.toISOString()).toBe(OLD.toISOString());

    const client = purged!.signers.find((s) => s.role === 'client');
    const operator = purged!.signers.find((s) => s.role === 'operator');
    expect(client).toMatchObject({ name: '(개인정보 파기됨)', signatureData: null, ipAddress: null });
    expect(operator).toMatchObject({ name: '스튜디오 놀 대표 황경하', ipAddress: '198.51.100.1' });
  });

  it('끝난 날을 소급해 적은 새 기록은 만들자마자 파기되지 않는다', async () => {
    await seed('backdated', 'completed', { completedAt: OLD, createdAt: RECENT });
    expect(await purgeExpiredProductionPersonalData(NOW)).toEqual({ purged: 0, failed: 0 });
  });

  it('PDF 삭제가 실패하면 파기 표식을 남기지 않는다 — 다음 회차에 다시 시도한다', async () => {
    await seed('c1', 'completed', { completedAt: OLD });
    mockDel.mockRejectedValueOnce(new Error('blob down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(await purgeExpiredProductionPersonalData(NOW)).toEqual({ purged: 0, failed: 1 });
    expect((await load('c1'))?.purgedAt).toBeNull();
  });
});
