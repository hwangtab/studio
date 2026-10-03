/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

let mockSession: { creatorId?: string; sessionVersion?: number; destroy: jest.Mock };
jest.mock('./creatorSession', () => ({
  getCreatorSession: async () => mockSession,
  getCreatorSessionFromContext: async () => mockSession,
}));

// eslint-disable-next-line import/first
import { logoutCreatorSession, verifyCreatorSessionVersion } from './creatorAuth';

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
  mockSession = { destroy: jest.fn() };
});
afterEach(() => client.close());

const seedCreator = async () => {
  const [row] = await mockDb.insert(schema.fundingCreators).values({ email: 'a@example.com', name: '가나' }).returning();
  return row;
};
const versionOf = async (id: string) =>
  (await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, id)))[0].sessionVersion;

describe('logoutCreatorSession', () => {
  it('판본을 올려 유출된 쿠키(같은 판본)를 서버에서 죽인다', async () => {
    const creator = await seedCreator();
    mockSession.creatorId = creator.id;
    mockSession.sessionVersion = creator.sessionVersion;
    expect(await verifyCreatorSessionVersion(creator.id, creator.sessionVersion)).toBe(true);

    await logoutCreatorSession({} as never, {} as never);

    expect(mockSession.destroy).toHaveBeenCalled();
    expect(await versionOf(creator.id)).toBe(creator.sessionVersion + 1);
    // 쿠키를 복사해 둔 쪽은 이제 통과하지 못한다.
    expect(await verifyCreatorSessionVersion(creator.id, creator.sessionVersion)).toBe(false);
  });

  it('이미 무효인 옛 쿠키로 로그아웃해도 지금 세션의 판본을 올리지 않는다', async () => {
    const creator = await seedCreator();
    mockSession.creatorId = creator.id;
    mockSession.sessionVersion = creator.sessionVersion - 1;

    await logoutCreatorSession({} as never, {} as never);

    expect(await versionOf(creator.id)).toBe(creator.sessionVersion);
    expect(mockSession.destroy).toHaveBeenCalled();
  });

  it('세션이 없으면 아무 행도 건드리지 않고 파기만 한다', async () => {
    const creator = await seedCreator();
    await logoutCreatorSession({} as never, {} as never);
    expect(await versionOf(creator.id)).toBe(creator.sessionVersion);
    expect(mockSession.destroy).toHaveBeenCalled();
  });
});
