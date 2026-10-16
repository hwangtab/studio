/** @jest-environment node */

/**
 * 개설자 사업자 정보 자동 파기(`purgeExpiredBusinessProfiles`)를 실제 SQLite(in-memory)로 검증한다.
 * 주민등록번호 파기(`residentNumberRetention.test.ts`)의 거울이다 — 기산점은 **사업자 정산**
 * (`withholding_amount = 0`)의 지급 시각, 정산 기록이 없으면 계정 최종 활동.
 *
 * 공연·상점은 "등록돼 있는 동안"을 살아 있는 것으로 보므로 승인된 공연 등록·상점 아티스트가 있는 동안은 지우지 않는다.
 * 상점·공연 정산 기록(`partner_payouts`)은 펀딩 기록과 함께 기산점이 된다(아래 describe).
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import {
  creatorBusinessProfiles,
  fundingCreators,
  fundingProjectPayouts,
  fundingProjects,
  partnerPayouts,
  shopArtists,
  showSubmissions,
} from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { BUSINESS_PROFILE_RETENTION_YEARS, purgeExpiredBusinessProfiles } from './retention';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** 판정 기준 시각. 5년 경계 = 2021-08-24T18:00:00Z, 1년 경계 = 2025-08-24T18:00:00Z. */
const NOW = new Date('2026-08-24T18:00:00.000Z');

let seq = 0;

const addCreator = async (opts: { id: string; updatedAt?: string; certificateKey?: string | null; profile?: boolean }) => {
  seq += 1;
  await mockDb.insert(fundingCreators).values({
    id: opts.id,
    email: `creator${seq}@example.com`,
    name: `개설자${seq}`,
    taxType: 'invoice',
    createdAt: d('2020-01-01'),
    updatedAt: opts.updatedAt ? d(opts.updatedAt) : d('2020-01-01'),
  });
  if (opts.profile === false) return;
  await mockDb.insert(creatorBusinessProfiles).values({
    creatorId: opts.id,
    businessNumber: '1234567890',
    businessName: '상호',
    representativeName: '대표',
    certificateKey: opts.certificateKey ?? null,
  });
};

const addProject = async (opts: {
  id: string;
  creatorId: string;
  reviewStatus: 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected';
}) => {
  await mockDb.insert(fundingProjects).values({
    id: opts.id,
    slug: `project-${opts.id}`,
    creatorId: opts.creatorId,
    title: '프로젝트',
    summary: '요약',
    content: '본문',
    coverUrl: '/images/cover.webp',
    goalAmount: 1_000_000,
    startAt: d('2021-01-01'),
    endAt: d('2021-02-01'),
    reviewStatus: opts.reviewStatus,
  });
};

const addPayout = async (opts: { projectId: string; withholdingAmount: number; paidAt: string | null }) => {
  await mockDb.insert(fundingProjectPayouts).values({
    projectId: opts.projectId,
    grossAmount: 1_000_000,
    refundAmount: 0,
    supplyAmount: 900_000,
    feeAmount: 100_000,
    shareAmount: 900_000,
    withholdingAmount: opts.withholdingAmount,
    netAmount: 900_000 - opts.withholdingAmount,
    backerCount: 10,
    status: opts.paidAt ? 'paid' : 'pending',
    paidAt: opts.paidAt ? d(opts.paidAt) : null,
  });
};

const addShow = async (creatorId: string, reviewStatus: 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected') => {
  await mockDb.insert(showSubmissions).values({ creatorId, draftJson: '{}', reviewStatus });
};

const addShopArtist = async (creatorId: string) => {
  await mockDb.insert(shopArtists).values({ creatorId, slug: `artist-${creatorId}` });
};

const profileOf = async (id: string) =>
  (await mockDb.select().from(creatorBusinessProfiles).where(eq(creatorBusinessProfiles.creatorId, id)))[0];

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM partner_payouts');
  await client.execute('DELETE FROM creator_business_profiles');
  await client.execute('DELETE FROM shop_artists');
  await client.execute('DELETE FROM show_submissions');
  await client.execute('DELETE FROM funding_project_payouts');
  await client.execute('DELETE FROM funding_projects');
  await client.execute('DELETE FROM funding_creators');
  seq = 0;
});

afterAll(() => client.close());

const purge = (deleteBlob: jest.Mock = jest.fn().mockResolvedValue(undefined)) =>
  purgeExpiredBusinessProfiles(NOW, { deleteBlob });

describe('(A) 사업자 정산 기록이 있는 경우 — 기산점은 지급 시각', () => {
  it(`지급 후 ${BUSINESS_PROFILE_RETENTION_YEARS}년이 지났으면 지운다`, async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 0, paidAt: '2020-01-01' });

    expect((await purge()).purged).toBe(1);
    expect(await profileOf('c1')).toBeUndefined();
  });

  it(`지급 후 ${BUSINESS_PROFILE_RETENTION_YEARS}년이 안 지났으면 남긴다 — 세금계산서 대조 근거`, async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 0, paidAt: '2024-01-01' });

    expect((await purge()).purged).toBe(0);
    expect(await profileOf('c1')).toBeDefined();
  });

  it('다른 개설자의 최근 사업자 정산은 이 개설자를 붙잡지 않는다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 0, paidAt: '2020-01-01' });
    await addCreator({ id: 'c2' });
    await addProject({ id: 'p2', creatorId: 'c2', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p2', withholdingAmount: 0, paidAt: '2024-01-01' });

    expect((await purge()).purged).toBe(1);
    expect(await profileOf('c1')).toBeUndefined();
    expect(await profileOf('c2')).toBeDefined();
  });

  it('미지급 사업자 정산이 있으면 남긴다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 0, paidAt: '2020-01-01' });
    await addProject({ id: 'p2', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p2', withholdingAmount: 0, paidAt: null });

    expect((await purge()).purged).toBe(0);
  });

  it('원천징수 정산(세액 > 0)은 사업자 정산 기록으로 세지 않는다 — (B)로 판정된다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2026-08-01' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });

    expect((await purge()).purged).toBe(0);
  });
});

describe('(B) 사업자 정산 기록이 없는 경우 — 계정 최종 활동이 기산점', () => {
  it('1년 넘게 잠든 계정이면 지운다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01' });
    expect((await purge()).purged).toBe(1);
    expect(await profileOf('c1')).toBeUndefined();
  });

  it('최근까지 쓰던 계정이면 남긴다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2026-08-01' });
    expect((await purge()).purged).toBe(0);
  });
});

describe('살아 있는 일이 있으면 지우지 않는다', () => {
  it.each(['submitted', 'changes_requested', 'approved'] as const)('정산 전 %s 펀딩 프로젝트', async (status) => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: status });
    expect((await purge()).purged).toBe(0);
  });

  it.each(['submitted', 'changes_requested', 'approved'] as const)('%s 공연 등록', async (status) => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01' });
    await addShow('c1', status);
    expect((await purge()).purged).toBe(0);
  });

  it('상점 아티스트 — 상점은 정산 기록 표가 없다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01' });
    await addShopArtist('c1');
    expect((await purge()).purged).toBe(0);
  });

  it.each(['draft', 'rejected'] as const)('%s 공연 등록·프로젝트는 막지 않는다', async (status) => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01' });
    await addShow('c1', status);
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: status });
    expect((await purge()).purged).toBe(1);
  });

  it('다른 개설자의 살아 있는 일은 영향을 주지 않는다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01' });
    await addCreator({ id: 'c2', updatedAt: '2024-01-01' });
    await addShopArtist('c2');
    await addShow('c2', 'approved');

    expect((await purge()).purged).toBe(1);
    expect(await profileOf('c1')).toBeUndefined();
    expect(await profileOf('c2')).toBeDefined();
  });
});

describe('사업자등록증 파일', () => {
  it('행을 지운 뒤 그 키로 Blob을 지운다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01', certificateKey: 'tax-docs/c1/abc.pdf' });
    await addCreator({ id: 'c2', updatedAt: '2024-01-01' });
    const deleteBlob = jest.fn().mockResolvedValue(undefined);

    expect((await purge(deleteBlob)).purged).toBe(2);
    expect(deleteBlob).toHaveBeenCalledTimes(1);
    expect(deleteBlob).toHaveBeenCalledWith('tax-docs/c1/abc.pdf');
  });

  it('남기는 계정의 사업자등록증은 지우지 않는다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01', certificateKey: 'tax-docs/c1/abc.pdf' });
    await addShopArtist('c1');
    const deleteBlob = jest.fn();

    await purge(deleteBlob);
    expect(deleteBlob).not.toHaveBeenCalled();
  });

  it('Blob 삭제가 실패해도 행 파기는 성공으로 센다(고아 청소가 다음 달에 지운다)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await addCreator({ id: 'c1', updatedAt: '2024-01-01', certificateKey: 'tax-docs/c1/abc.pdf' });
    const deleteBlob = jest.fn().mockRejectedValue(new Error('blob 장애'));

    expect((await purge(deleteBlob)).purged).toBe(1);
    expect(await profileOf('c1')).toBeUndefined();
  });
});

describe('파기 범위', () => {
  it('개설자 계정·정산 기록은 그대로 둔다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 0, paidAt: '2020-01-01' });

    await purge();
    expect(await mockDb.select().from(fundingCreators)).toHaveLength(1);
    expect(await mockDb.select().from(fundingProjectPayouts)).toHaveLength(1);
  });

  it('두 번 돌려도 결과가 같다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2024-01-01' });
    expect((await purge()).purged).toBe(1);
    expect((await purge()).purged).toBe(0);
  });
});

const addPartnerPayout = async (opts: { creatorId: string; kind?: 'shop' | 'show'; withholdingAmount: number; paidAt: string | null }) => {
  seq += 1;
  await mockDb.insert(partnerPayouts).values({
    kind: opts.kind ?? 'shop',
    subjectKey: `creator:${opts.creatorId}`,
    period: `2026-0${(seq % 8) + 1}`,
    creatorId: opts.creatorId,
    payeeName: '수취인',
    taxType: 'invoice',
    shareAmount: 100_000,
    withholdingAmount: opts.withholdingAmount,
    netAmount: 100_000 - opts.withholdingAmount,
    status: opts.paidAt ? 'paid' : 'pending',
    paidAt: opts.paidAt ? d(opts.paidAt) : null,
  });
};

describe('상점·공연 사업자 정산 기록(partner_payouts)도 세금계산서 대조 근거로 센다', () => {
  it(`상점 사업자 정산만 있는 개설자: 지급 후 ${BUSINESS_PROFILE_RETENTION_YEARS}년 안이면, 계정이 1년 넘게 잠들어도 남긴다`, async () => {
    await addCreator({ id: 'c1', updatedAt: '2022-01-01' });
    await addPartnerPayout({ creatorId: 'c1', withholdingAmount: 0, paidAt: '2024-01-01' });

    expect((await purge()).purged).toBe(0);
    expect(await profileOf('c1')).toBeDefined();
  });

  it('공연 사업자 정산도 같고, 보관 기간이 지났으면 지운다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2022-01-01' });
    await addPartnerPayout({ creatorId: 'c1', kind: 'show', withholdingAmount: 0, paidAt: '2025-01-01' });
    expect((await purge()).purged).toBe(0);

    await client.execute('DELETE FROM partner_payouts');
    await addPartnerPayout({ creatorId: 'c1', kind: 'show', withholdingAmount: 0, paidAt: '2020-01-01' });
    expect((await purge()).purged).toBe(1);
    expect(await profileOf('c1')).toBeUndefined();
  });

  it('아직 지급하지 않은 상점 사업자 정산이 있으면 남긴다', async () => {
    await addCreator({ id: 'c1' });
    await addPartnerPayout({ creatorId: 'c1', withholdingAmount: 0, paidAt: '2020-01-01' });
    await addPartnerPayout({ creatorId: 'c1', withholdingAmount: 0, paidAt: null });

    expect((await purge()).purged).toBe(0);
    expect(await profileOf('c1')).toBeDefined();
  });

  it('펀딩·상점 중 가장 나중 지급이 기준이다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 0, paidAt: '2020-01-01' });
    await addPartnerPayout({ creatorId: 'c1', withholdingAmount: 0, paidAt: '2024-01-01' });

    expect((await purge()).purged).toBe(0);
  });

  it('원천징수한 상점 정산(세액 > 0)은 사업자 정산이 아니다 — 사업자 기록이 없는 것과 같다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2026-08-01' });
    await addPartnerPayout({ creatorId: 'c1', withholdingAmount: 726, paidAt: '2020-01-01' });

    // (B) 휴면 1년이 안 지났으므로 남는다 — 정산 기록이 기산점이 되어 지워지지 않는다.
    expect((await purge()).purged).toBe(0);
    await client.execute("UPDATE funding_creators SET updated_at = 1577836800 WHERE id = 'c1'"); // 2020-01-01
    expect((await purge()).purged).toBe(1);
  });
});

describe('표가 없으면 던진다(파기하지 않는다)', () => {
  it('creator_business_profiles가 없으면 오류', async () => {
    const empty = createClient({ url: ':memory:' });
    const saved = mockDb;
    mockDb = drizzle(empty, { schema });
    try {
      // drizzle은 "Failed query: …"로 감싸고 원인(no such table)을 cause에 둔다.
      const error = await purge().then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(String((error as Error).cause)).toMatch(/no such table/i);
    } finally {
      mockDb = saved;
      empty.close();
    }
  });
});
