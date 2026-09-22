/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { decidePublicStatus } from './publicStatusDecision';

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

const seedCreator = async (email: string, name = '개설자'): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name }).returning();
  return creator.id;
};

const seedProject = async (
  creatorId: string,
  overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {},
): Promise<string> => {
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    creatorId,
    slug: `slug-${crypto.randomUUID()}`,
    title: '제목',
    summary: '요약',
    content: '본'.repeat(210),
    coverUrl: '/uploads/funding/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date('2026-10-01T00:00:00Z'),
    endAt: new Date('2026-10-31T00:00:00Z'),
    reviewStatus: 'submitted',
    ...overrides,
  }).returning();
  return project.id;
};

const readProject = async (id: string) => {
  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, id));
  return row;
};

describe('승인 전 프로젝트', () => {
  it('draft·submitted 상태에서는 close·hide 둘 다 거부한다', async () => {
    const creator = await seedCreator('a@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'submitted', status: 'draft' });

    const close = await decidePublicStatus(projectId, 'close', { note: '사유' });
    expect(close.ok).toBe(false);
    if (!close.ok) expect(close.code).toBe('conflict');

    const hide = await decidePublicStatus(projectId, 'hide', {});
    expect(hide.ok).toBe(false);

    const after = await readProject(projectId);
    expect(after.status).toBe('draft');
    expect(after.hidden).toBe(false);
  });

  it('없는 프로젝트는 not_found', async () => {
    const result = await decidePublicStatus('ghost', 'close', { note: '사유' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_found');
  });
});

describe('종료(close)', () => {
  const approved = async (overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {}) => {
    const creator = await seedCreator(`close-${crypto.randomUUID()}@example.com`);
    return seedProject(creator, { reviewStatus: 'approved', status: 'auto', ...overrides });
  };

  it('사유 없이는 거부한다 — DB도 그대로다', async () => {
    const projectId = await approved();
    const result = await decidePublicStatus(projectId, 'close', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('incomplete');
    const after = await readProject(projectId);
    expect(after.status).toBe('auto');
  });

  it('사유가 있으면 status가 closed로 바뀌고 reviewNote·lastmod를 함께 남긴다', async () => {
    const projectId = await approved();
    const now = new Date('2026-09-22T15:30:00Z');
    const result = await decidePublicStatus(projectId, 'close', { note: '가격 오류 발견' }, now);
    expect(result.ok).toBe(true);

    const after = await readProject(projectId);
    expect(after.status).toBe('closed');
    expect(after.reviewNote).toBe('가격 오류 발견');
    // UTC 15:30 = KST 00:30(다음날) — 날짜 경계를 실제로 넘겨서 KST 변환이 적용됐는지 본다.
    expect(after.lastmod).toBe('2026-09-23');
  });

  it('이미 closed면 다시 종료할 수 없다(낙관적 잠금) — 두 번째 호출은 conflict', async () => {
    const projectId = await approved({ status: 'closed' });
    const result = await decidePublicStatus(projectId, 'close', { note: '사유' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict');
  });
});

describe('다시 열기(reopen)', () => {
  it('closed → auto로 되돌린다 — 종료가 편도가 아니다', async () => {
    const creator = await seedCreator('reopen@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'closed',
      reviewNote: '종료 사유',
    });

    const result = await decidePublicStatus(projectId, 'reopen', {});
    expect(result.ok).toBe(true);
    const after = await readProject(projectId);
    expect(after.status).toBe('auto');
  });

  it('사유 없이 되돌리면 기존 reviewNote(종료 사유)를 보존한다', async () => {
    const creator = await seedCreator('reopen-note@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'closed',
      reviewNote: '종료 사유',
    });

    await decidePublicStatus(projectId, 'reopen', {});
    const after = await readProject(projectId);
    expect(after.reviewNote).toBe('종료 사유');
  });

  it('이미 auto면 다시 열 수 없다 — conflict', async () => {
    const creator = await seedCreator('reopen-conflict@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto' });
    const result = await decidePublicStatus(projectId, 'reopen', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict');
  });
});

describe('숨김(hide)·노출(unhide)', () => {
  it('hide는 사유 없이도 되고 hidden을 true로 바꾼다', async () => {
    const creator = await seedCreator('hide@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto', hidden: false });

    const result = await decidePublicStatus(projectId, 'hide', {});
    expect(result.ok).toBe(true);
    const after = await readProject(projectId);
    expect(after.hidden).toBe(true);
    // status는 건드리지 않는다 — 숨김은 별개 축이라 모금은 계속 열려 있다.
    expect(after.status).toBe('auto');
  });

  it('unhide는 hidden을 false로 되돌린다', async () => {
    const creator = await seedCreator('unhide@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto', hidden: true });

    const result = await decidePublicStatus(projectId, 'unhide', {});
    expect(result.ok).toBe(true);
    const after = await readProject(projectId);
    expect(after.hidden).toBe(false);
  });

  it('이미 숨겨진 프로젝트를 다시 hide하면 conflict', async () => {
    const creator = await seedCreator('hide-conflict@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto', hidden: true });
    const result = await decidePublicStatus(projectId, 'hide', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict');
  });

  it('hide·unhide는 reviewNote를 건드리지 않는다', async () => {
    const creator = await seedCreator('hide-note@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'auto',
      hidden: false,
      reviewNote: '기존 메모',
    });
    await decidePublicStatus(projectId, 'hide', {});
    const after = await readProject(projectId);
    expect(after.reviewNote).toBe('기존 메모');
  });
});
