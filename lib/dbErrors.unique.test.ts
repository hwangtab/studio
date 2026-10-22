import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { isUniqueConstraintError } from './dbErrors';

const t = sqliteTable('t', { id: text('id').primaryKey(), slug: text('slug').unique(), name: text('name').notNull() });

const setup = async () => {
  const client = createClient({ url: ':memory:' });
  await client.execute('CREATE TABLE t (id text PRIMARY KEY, slug text UNIQUE, name text NOT NULL)');
  return { client, db: drizzle(client) };
};

const caught = async (fn: () => Promise<unknown>): Promise<unknown> => {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error('던지지 않았다');
};

describe('isUniqueConstraintError — drizzle 0.45가 감싼 실제 오류로', () => {
  it('단일 문장 INSERT의 PK·UNIQUE 위반을 잡는다 — 원문이 cause에만 있어도', async () => {
    const { db } = await setup();
    await db.insert(t).values({ id: 'a', slug: 's', name: 'n' });
    const pk = await caught(() => db.insert(t).values({ id: 'a', slug: 'x', name: 'n' }));
    // 감싼 오류의 message에는 원문이 없다 — 예전 판정(String(error).includes('UNIQUE'))이 놓치던 이유.
    expect(String(pk)).not.toContain('UNIQUE');
    expect(isUniqueConstraintError(pk)).toBe(true);
    expect(isUniqueConstraintError(pk, 't.id')).toBe(true);
    expect(isUniqueConstraintError(pk, 't.slug')).toBe(false);

    const uq = await caught(() => db.insert(t).values({ id: 'b', slug: 's', name: 'n' }));
    expect(isUniqueConstraintError(uq, 't.slug')).toBe(true);
  });

  it('db.batch의 위반도 잡는다(원문이 message에 있는 경로)', async () => {
    const { db } = await setup();
    await db.insert(t).values({ id: 'a', slug: 's', name: 'n' });
    const err = await caught(() => db.batch([db.insert(t).values({ id: 'a', slug: 'z', name: 'n' })]));
    expect(isUniqueConstraintError(err, 't.id')).toBe(true);
  });

  it('NOT NULL 같은 다른 제약 위반·일반 오류는 아니다', async () => {
    const { client } = await setup();
    const notNull = await caught(() => client.execute("INSERT INTO t (id, slug) VALUES ('c', 'q')"));
    expect(isUniqueConstraintError(notNull)).toBe(false);
    expect(isUniqueConstraintError(new Error('network'))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
