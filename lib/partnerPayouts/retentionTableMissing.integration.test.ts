/** @jest-environment node */

/**
 * 정산 기록 표(`partner_payouts`, 마이그레이션 0067)가 아직 없는 DB에서 보존·파기 코드가 어떻게 구는가.
 * 규칙: 표가 없으면 기록도 없으니 펀딩 기록만으로 판정한다(월간 파기 크론이 배포~마이그레이션 사이에 매달 실패하지 않게).
 * 표가 있는지 확인하지 못하는 그 밖의 오류는 던져 파기를 멈춘다 — 모르면 지우지 않는다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { creatorBusinessProfiles, fundingCreators, fundingProjectPayouts, fundingProjects } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { purgeExpiredBusinessProfiles, purgeExpiredResidentNumbers } from '../funding/retention';
import { hasPartnerInvoicePayout, hasPartnerWithheldPayout, partnerPayoutsTableExists } from './creatorPayouts';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-08-24T18:00:00.000Z');
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ENC = 'v2:k1:0000:0000:ciphertext';
let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});
afterEach(() => client.close());

const addCreator = async (id: string, updatedAt: string) => {
  await mockDb.insert(fundingCreators).values({
    id, email: `${id}@example.com`, name: id, taxType: 'withholding', residentNumberEnc: ENC, createdAt: d('2020-01-01'), updatedAt: d(updatedAt),
  });
  await mockDb.insert(creatorBusinessProfiles).values({ creatorId: id, businessNumber: '1234567890', businessName: '상호', representativeName: '대표' });
};

describe('partner_payouts 표가 없는 DB', () => {
  beforeEach(async () => {
    await client.execute('DROP TABLE partner_payout_adjustments');
    await client.execute('DROP TABLE partner_payouts');
  });

  it('표 존재 확인은 false, 개설자 단위 판정은 거짓(= 기록 없음)', async () => {
    expect(await partnerPayoutsTableExists()).toBe(false);
    expect(await hasPartnerWithheldPayout('c1')).toBe(false);
    expect(await hasPartnerInvoicePayout('c1')).toBe(false);
  });

  it('주민등록번호·사업자 정보 파기는 펀딩 기록만으로 돈다 — 던지지 않고, 펀딩 기록이 붙잡는 계정은 그대로 남긴다', async () => {
    await addCreator('dormant', '2020-01-01'); // 정산 기록 없음 + 1년 넘게 잠듦 → 파기 대상
    await addCreator('withheld', '2020-01-01'); // 최근 원천징수 펀딩 정산 → 주민등록번호 보관
    await addCreator('invoiced', '2020-01-01'); // 최근 사업자 펀딩 정산 → 사업자 정보 보관
    const project = (id: string, creatorId: string) => mockDb.insert(fundingProjects).values({
      id, slug: id, creatorId, title: 't', summary: 's', content: 'c', coverUrl: '/c.webp', goalAmount: 1,
      startAt: d('2021-01-01'), endAt: d('2021-02-01'), reviewStatus: 'approved',
    });
    const payout = (projectId: string, withholdingAmount: number) => mockDb.insert(fundingProjectPayouts).values({
      projectId, grossAmount: 1, refundAmount: 0, supplyAmount: 1, feeAmount: 0, shareAmount: 1, withholdingAmount, netAmount: 1,
      backerCount: 1, status: 'paid', paidAt: d('2025-12-01'),
    });
    await project('p1', 'withheld');
    await payout('p1', 33);
    await project('p2', 'invoiced');
    await payout('p2', 0);

    // 주민등록번호: dormant·invoiced(원천징수 기록 없음, 잠듦)는 파기, withheld는 보관.
    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(2);
    const rows = await mockDb.select({ id: fundingCreators.id, enc: fundingCreators.residentNumberEnc }).from(fundingCreators);
    expect(rows.find((r) => r.id === 'dormant')?.enc).toBeNull();
    expect(rows.find((r) => r.id === 'invoiced')?.enc).toBeNull();
    expect(rows.find((r) => r.id === 'withheld')?.enc).toBe(ENC);

    // 사업자 정보: dormant·withheld(사업자 정산 기록 없음, 잠듦)는 파기, invoiced는 보관.
    expect((await purgeExpiredBusinessProfiles(NOW, { deleteBlob: jest.fn() })).purged).toBe(2);
    const left = await mockDb.select({ id: creatorBusinessProfiles.creatorId }).from(creatorBusinessProfiles);
    expect(left.map((r) => r.id)).toEqual(['invoiced']);
  });
});

describe('표를 확인하지 못하는 그 밖의 오류는 던져서 파기를 멈춘다', () => {
  it('partnerPayoutsTableExists는 no such table이 아닌 오류를 삼키지 않는다', async () => {
    const saved = mockDb;
    mockDb = { run: () => Promise.reject(new Error('SQLITE_BUSY: database is locked')) } as unknown as typeof mockDb;
    try {
      await expect(partnerPayoutsTableExists()).rejects.toThrow(/locked/);
      await expect(purgeExpiredResidentNumbers(NOW)).rejects.toThrow(/locked/);
    } finally {
      mockDb = saved;
    }
  });

  it('개설자 단위 판정은 읽기 실패 시 참(= 지우지 않고 남긴다)', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const saved = mockDb;
    mockDb = { select: () => { throw new Error('SQLITE_BUSY: database is locked'); } } as unknown as typeof mockDb;
    try {
      expect(await hasPartnerWithheldPayout('c1')).toBe(true);
      expect(await hasPartnerInvoicePayout('c1')).toBe(true);
    } finally {
      mockDb = saved;
      error.mockRestore();
    }
    expect((await mockDb.select().from(fundingCreators).where(eq(fundingCreators.id, 'c1')))).toEqual([]);
  });
});
