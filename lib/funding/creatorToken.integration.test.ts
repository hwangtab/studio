/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { consumeCreatorLoginToken, issueCreatorLoginToken, normalizeCreatorEmail } from './creatorToken';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-09-20T03:00:00Z');
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

describe('normalizeCreatorEmail', () => {
  it('공백을 떼고 소문자로 만든다', () => {
    expect(normalizeCreatorEmail('  A@Example.COM ')).toBe('a@example.com');
  });
  it('형식이 아니면 null', () => {
    expect(normalizeCreatorEmail('not-an-email')).toBeNull();
    expect(normalizeCreatorEmail('')).toBeNull();
    expect(normalizeCreatorEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });
});

describe('매직링크 토큰', () => {
  it('처음 보는 이메일이면 개설자 행을 만든다', async () => {
    const issued = await issueCreatorLoginToken('new@example.com', NOW);
    expect(issued).not.toBeNull();
    const creators = await mockDb.select().from(schema.fundingCreators);
    expect(creators).toHaveLength(1);
    expect(creators[0].email).toBe('new@example.com');
  });

  it('원문이 아니라 해시만 저장한다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    const [row] = await mockDb.select().from(schema.fundingCreatorTokens);
    expect(row.tokenHash).not.toBe(issued!.rawToken);
    expect(row.tokenHash).toBe(createHash('sha256').update(issued!.rawToken).digest('hex'));
  });

  it('소진하면 creatorId를 주고 두 번째는 거부한다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    const first = await consumeCreatorLoginToken(issued!.rawToken, NOW);
    expect(first!.creatorId).toBe(issued!.creatorId);
    expect(await consumeCreatorLoginToken(issued!.rawToken, NOW)).toBeNull();
  });

  it('15분이 지나면 거부한다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    const late = new Date(NOW.getTime() + 901 * 1000);
    expect(await consumeCreatorLoginToken(issued!.rawToken, late)).toBeNull();
  });

  it('없는 토큰은 거부한다', async () => {
    expect(await consumeCreatorLoginToken('nope', NOW)).toBeNull();
  });

  it('소진하면 마지막 로그인 시각을 남긴다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    await consumeCreatorLoginToken(issued!.rawToken, NOW);
    const [creator] = await mockDb.select().from(schema.fundingCreators);
    expect(creator.lastLoginAt?.getTime()).toBe(NOW.getTime());
  });

  it('새 토큰을 내면 그 사람의 옛 토큰은 못 쓴다', async () => {
    const first = await issueCreatorLoginToken('a@example.com', NOW);
    const second = await issueCreatorLoginToken('a@example.com', NOW);
    expect(await consumeCreatorLoginToken(first!.rawToken, NOW)).toBeNull();
    expect(await consumeCreatorLoginToken(second!.rawToken, NOW)).not.toBeNull();
  });

  // 처음 보는 이메일로 두 요청이 겹치는 경우(서버리스 인스턴스 분산, 더블클릭 등).
  // 인메모리 libSQL은 단일 커넥션이라 진짜 경합(두 트랜잭션이 동시에 같은 행을 못 봄)까지는
  // 재현하지 못하지만, Promise.all로 겹쳐 호출했을 때 select-then-insert였다면 났을
  // UNIQUE 위반 예외가 나지 않고 개설자 행이 정확히 하나로 수렴하는지는 검증한다.
  it('같은 새 이메일로 동시에 발급해도 예외 없이 개설자 행이 하나다', async () => {
    const [first, second] = await Promise.all([
      issueCreatorLoginToken('concurrent@example.com', NOW),
      issueCreatorLoginToken('concurrent@example.com', NOW),
    ]);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const creators = await mockDb.select().from(schema.fundingCreators);
    expect(creators).toHaveLength(1);
  });

  // 위 동시 발급 중 나중에 반영된 토큰은 재발급 무효화 규칙과 어긋나지 않게 최소한 소진
  // 가능해야 한다(둘 다 살아 있으라는 뜻은 아니다 — "새 토큰 발급 시 옛 미사용 토큰 무효화"
  // 규칙이 여기서도 지켜지는지가 관심사다).
  it('동시 발급 중 나중에 반영된 토큰은 소진할 수 있다', async () => {
    const [, second] = await Promise.all([
      issueCreatorLoginToken('concurrent2@example.com', NOW),
      issueCreatorLoginToken('concurrent2@example.com', NOW),
    ]);
    expect(await consumeCreatorLoginToken(second!.rawToken, NOW)).not.toBeNull();
  });
});
