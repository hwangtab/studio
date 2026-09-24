/** @jest-environment node */

/**
 * 개설자 주민등록번호 자동 파기(`purgeExpiredResidentNumbers`)를 실제 SQLite(in-memory)로
 * 검증한다. 후원자 배송지 파기(`retention.test.ts`)와 같은 이유로 실 DB를 쓴다 — 상관
 * 서브쿼리(EXISTS/NOT EXISTS)와 날짜 비교가 실제로 어떻게 도는지는 모킹으로 알 수 없다.
 *
 * **이 파일에는 주민등록번호 형태의 값이 없다.** 컬럼에 들어가는 것은 암호문이고, 테스트도
 * 암호문 자리표시자만 쓴다 — 평문을 고정 출력에 남기지 않는다는 원칙이 테스트에도 걸린다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { fundingCreators, fundingProjectPayouts, fundingProjects } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import {
  purgeExpiredResidentNumbers,
  RESIDENT_NUMBER_DORMANT_YEARS,
  RESIDENT_NUMBER_RETENTION_YEARS,
} from './retention';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** 판정 기준 시각. 5년 경계 = 2021-08-24T18:00:00Z, 1년 경계 = 2025-08-24T18:00:00Z. */
const NOW = new Date('2026-08-24T18:00:00.000Z');

/** 실제 컬럼에 들어가는 것은 암호문이다. 평문은 이 저장소 어디에도 없다. */
const ENC = 'v2:k1:0000:0000:ciphertext';

let seq = 0;

const addCreator = async (opts: {
  id: string;
  residentNumberEnc?: string | null;
  updatedAt?: string;
}) => {
  seq += 1;
  await mockDb.insert(fundingCreators).values({
    id: opts.id,
    email: `creator${seq}@example.com`,
    name: `개설자${seq}`,
    taxType: 'withholding',
    payoutAccountEnc: 'v2:00000000:aaaa:bbbb:cccc',
    payoutAccountLast4: '1234',
    residentNumberEnc: opts.residentNumberEnc === undefined ? ENC : opts.residentNumberEnc,
    createdAt: d('2020-01-01'),
    updatedAt: opts.updatedAt ? d(opts.updatedAt) : d('2020-01-01'),
  });
};

const addProject = async (opts: {
  id: string;
  creatorId: string;
  reviewStatus: 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected';
}) => {
  seq += 1;
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

const addPayout = async (opts: {
  projectId: string;
  withholdingAmount: number;
  paidAt: string | null;
}) => {
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

const creatorOf = async (id: string) =>
  (await mockDb.select().from(fundingCreators).where(eq(fundingCreators.id, id)))[0];

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split(
      '--> statement-breakpoint',
    )) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM funding_project_payouts');
  await client.execute('DELETE FROM funding_projects');
  await client.execute('DELETE FROM funding_creators');
  seq = 0;
});

afterAll(() => client.close());

describe('원천징수 기록이 있는 경우 — 기산점은 정산의 지급 시각', () => {
  it('지급 후 보관 기간이 안 지났으면 보관한다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2024-01-01' });

    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
    expect((await creatorOf('c1')).residentNumberEnc).toBe(ENC);
  });

  it('지급 후 보관 기간이 지났으면 파기한다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });

    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(1);
    expect((await creatorOf('c1')).residentNumberEnc).toBeNull();
  });

  it('여러 건이면 가장 나중 지급이 기준이다 — 하나라도 기간 안이면 보관한다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addProject({ id: 'p2', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });
    await addPayout({ projectId: 'p2', withholdingAmount: 33_000, paidAt: '2024-01-01' });

    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
    expect((await creatorOf('c1')).residentNumberEnc).toBe(ENC);
  });

  it('원천징수액이 0인 정산(사업자 정산)은 기산점이 되지 않는다', async () => {
    // 이 개설자는 원천징수 기록이 한 번도 없는 것과 같다 — (B) 경로로 판정된다.
    await addCreator({ id: 'c1', updatedAt: '2026-08-01' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 0, paidAt: '2020-01-01' });

    // (B)의 휴면 기간(1년)이 안 지났으므로 보관.
    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
    expect((await creatorOf('c1')).residentNumberEnc).toBe(ENC);
  });

  it('원천징수했지만 아직 지급되지 않은 정산이 있으면 파기하지 않는다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2020-01-01' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });
    await addProject({ id: 'p2', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p2', withholdingAmount: 33_000, paidAt: null });

    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
    expect((await creatorOf('c1')).residentNumberEnc).toBe(ENC);
  });

  describe(`${RESIDENT_NUMBER_RETENTION_YEARS}년 경계(초 단위)`, () => {
    const boundary = new Date(NOW);
    boundary.setFullYear(boundary.getFullYear() - RESIDENT_NUMBER_RETENTION_YEARS);

    const seed = async (paidAt: Date) => {
      await addCreator({ id: 'c1' });
      await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
      await mockDb.insert(fundingProjectPayouts).values({
        projectId: 'p1',
        grossAmount: 1_000_000,
        refundAmount: 0,
        supplyAmount: 900_000,
        feeAmount: 100_000,
        shareAmount: 900_000,
        withholdingAmount: 33_000,
        netAmount: 867_000,
        backerCount: 10,
        status: 'paid',
        paidAt,
      });
    };

    it('경계 1초 전에 지급된 정산은 파기한다', async () => {
      await seed(new Date(boundary.getTime() - 1000));
      expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(1);
    });

    it('경계와 정확히 같은 시각에 지급된 정산은 아직 보관한다', async () => {
      await seed(new Date(boundary.getTime()));
      expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
    });
  });
});

describe('정산이 남은 프로젝트가 있으면 지우지 않는다', () => {
  it.each(['submitted', 'changes_requested', 'approved'] as const)(
    '%s 프로젝트에 지급 완료된 정산이 없으면 보관한다',
    async (reviewStatus) => {
      await addCreator({ id: 'c1', updatedAt: '2020-01-01' });
      // 과거 원천징수는 이미 보관 기간이 지났다 — (A)만 보면 파기 대상이다.
      await addProject({ id: 'old', creatorId: 'c1', reviewStatus: 'approved' });
      await addPayout({ projectId: 'old', withholdingAmount: 33_000, paidAt: '2020-01-01' });
      // 그러나 아직 정산하지 않은 프로젝트가 남아 있다 — 곧 쓸 값이다.
      await addProject({ id: 'live', creatorId: 'c1', reviewStatus });

      expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
      expect((await creatorOf('c1')).residentNumberEnc).toBe(ENC);
    },
  );

  it.each(['draft', 'rejected'] as const)(
    '%s 프로젝트는 정산으로 이어지지 않으므로 파기를 막지 않는다',
    async (reviewStatus) => {
      await addCreator({ id: 'c1' });
      await addProject({ id: 'old', creatorId: 'c1', reviewStatus: 'approved' });
      await addPayout({ projectId: 'old', withholdingAmount: 33_000, paidAt: '2020-01-01' });
      await addProject({ id: 'other', creatorId: 'c1', reviewStatus });

      expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(1);
    },
  );

  it('다른 개설자의 정산 대기 프로젝트는 영향을 주지 않는다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });

    await addCreator({ id: 'c2' });
    await addProject({ id: 'p2', creatorId: 'c2', reviewStatus: 'approved' });

    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(1);
    expect((await creatorOf('c1')).residentNumberEnc).toBeNull();
    expect((await creatorOf('c2')).residentNumberEnc).toBe(ENC);
  });
});

describe('원천징수 기록이 한 번도 없는 경우 — 계정 최종 활동이 기산점', () => {
  it('최근까지 쓰던 계정이면 보관한다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2026-08-01' });
    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
    expect((await creatorOf('c1')).residentNumberEnc).toBe(ENC);
  });

  it(`${RESIDENT_NUMBER_DORMANT_YEARS}년 넘게 잠든 계정이면 파기한다`, async () => {
    await addCreator({ id: 'c1', updatedAt: '2022-01-01' });
    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(1);
    expect((await creatorOf('c1')).residentNumberEnc).toBeNull();
  });

  it('잠들었어도 심사 중인 프로젝트가 있으면 보관한다', async () => {
    await addCreator({ id: 'c1', updatedAt: '2022-01-01' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'submitted' });
    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
    expect((await creatorOf('c1')).residentNumberEnc).toBe(ENC);
  });
});

describe('파기 범위', () => {
  it('주민등록번호 컬럼만 비우고 계좌·세금 구분·연락처·updated_at은 그대로 둔다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });

    const before = await creatorOf('c1');
    await purgeExpiredResidentNumbers(NOW);
    const after = await creatorOf('c1');

    expect(after.residentNumberEnc).toBeNull();
    expect({ ...after, residentNumberEnc: ENC }).toEqual(before);
  });

  it('정산 기록(원천징수액·지급일)은 지우지 않는다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });

    await purgeExpiredResidentNumbers(NOW);
    const [payout] = await mockDb.select().from(fundingProjectPayouts);
    expect(payout.withholdingAmount).toBe(33_000);
    expect(payout.paidAt).toEqual(d('2020-01-01'));
  });

  it('이미 비어 있는 계정은 다시 파기하지 않는다(idempotent)', async () => {
    await addCreator({ id: 'c1', residentNumberEnc: null });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });

    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
  });

  it('두 번 돌려도 결과가 같다', async () => {
    await addCreator({ id: 'c1' });
    await addProject({ id: 'p1', creatorId: 'c1', reviewStatus: 'approved' });
    await addPayout({ projectId: 'p1', withholdingAmount: 33_000, paidAt: '2020-01-01' });

    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(1);
    expect((await purgeExpiredResidentNumbers(NOW)).purged).toBe(0);
  });
});
