/** @jest-environment node */
import { createClient } from '@libsql/client';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { fundingPledges, orderTypeEnum } from './schema';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');

describe('funding schema', () => {
  it('orders.type에 funding이 있다', () => {
    expect(orderTypeEnum).toContain('funding');
  });

  it('마이그레이션을 적용하면 funding_pledges 테이블이 생긴다', async () => {
    const client = createClient({ url: ':memory:' });
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
      for (const statement of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
        if (statement.trim()) await client.execute(statement.trim());
      }
    }
    const rows = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='funding_pledges'");
    expect(rows.rows).toHaveLength(1);
    const cols = await client.execute('PRAGMA table_info(funding_pledges)');
    const names = cols.rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['order_id', 'project_slug', 'reward_id', 'hold_expires_at', 'fulfillment_status']));
    expect(fundingPledges).toBeDefined();
    client.close();
  });
});
