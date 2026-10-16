/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { hasApprovedEngagement } from './creatorEligibility';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

let n = 0;
const seedCreator = async () => {
  n += 1;
  const [c] = await mockDb.insert(schema.fundingCreators).values({ email: `e${n}@example.com`, name: '가나' }).returning();
  return c.id;
};

const seedProject = (creatorId: string, reviewStatus: (typeof schema.fundingReviewStatusEnum)[number]) =>
  mockDb.insert(schema.fundingProjects).values({
    slug: `p-${creatorId}-${reviewStatus}`, creatorId, title: 't', summary: 's', content: 'c', coverUrl: '/c.webp',
    goalAmount: 1_000_000, startAt: new Date('2026-10-01'), endAt: new Date('2026-10-31'), reviewStatus,
  });

describe('hasApprovedEngagement', () => {
  it('승인된 펀딩 프로젝트가 있으면 참', async () => {
    const c = await seedCreator();
    await seedProject(c, 'approved');
    expect(await hasApprovedEngagement(c)).toBe(true);
  });

  it('승인된 공연 등록이 있으면 참', async () => {
    const c = await seedCreator();
    await mockDb.insert(schema.showSubmissions).values({ creatorId: c, draftJson: '{}', reviewStatus: 'approved' });
    expect(await hasApprovedEngagement(c)).toBe(true);
  });

  it('상점 아티스트로 등록돼 있으면 참', async () => {
    const c = await seedCreator();
    await mockDb.insert(schema.shopArtists).values({ creatorId: c, slug: 'artist' });
    expect(await hasApprovedEngagement(c)).toBe(true);
  });

  it('반려된 공연·초안 프로젝트만 있으면 거짓', async () => {
    const c = await seedCreator();
    await seedProject(c, 'draft');
    await mockDb.insert(schema.showSubmissions).values({ creatorId: c, draftJson: '{}', reviewStatus: 'rejected' });
    expect(await hasApprovedEngagement(c)).toBe(false);
  });

  it('상점·공연 정산 기록(partner_payouts)이 있으면 승인된 일이 없어도 참 — 이미 기록한 정산의 계좌를 열 수 있어야 한다', async () => {
    const c = await seedCreator();
    expect(await hasApprovedEngagement(c)).toBe(false);
    await mockDb.insert(schema.partnerPayouts).values({
      kind: 'show', subjectKey: 'show-1', period: 'all', creatorId: c, payeeName: '가나', taxType: 'withholding', netAmount: 1,
    });
    expect(await hasApprovedEngagement(c)).toBe(true);
  });

  it('정산 기록 표가 없는 DB(0067 전)에서는 그 갈래만 없음으로 본다', async () => {
    const c = await seedCreator();
    await client.execute('DROP TABLE partner_payouts');
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await hasApprovedEngagement(c)).toBe(false);
    } finally {
      error.mockRestore();
    }
  });

  it('공연 표가 없는 DB에서도 상점 갈래는 참', async () => {
    const c = await seedCreator();
    await mockDb.insert(schema.shopArtists).values({ creatorId: c, slug: 'artist' });
    await client.execute('PRAGMA foreign_keys = OFF');
    await client.execute('DROP TABLE show_submissions');
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await hasApprovedEngagement(c)).toBe(true);
    } finally {
      error.mockRestore();
    }
  });
});
