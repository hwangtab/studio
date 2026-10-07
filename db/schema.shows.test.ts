import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as schema from './schema';

const MIGRATIONS_DIR = join(__dirname, '..', 'drizzle', 'migrations');

function applyMigrations(client: ReturnType<typeof createClient>) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const statements = sqlText.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      client.execute(stmt);
    }
  }
}

describe('shows 스키마', () => {
  it('9개 테이블이 마이그레이션으로 생성된다', async () => {
    const client = createClient({ url: ':memory:' });
    await applyMigrations(client as any);
    const db = drizzle(client, { schema });
    void db;
    const tables = await client.execute(
      "select name from sqlite_master where type='table' and name like 'show%'"
    );
    const names = tables.rows.map((r: any) => r.name).sort();
    expect(names).toEqual(
      ['show_order_locales', 'show_orders', 'show_report_links', 'show_scan_links', 'show_ticket_types', 'show_tickets', 'show_zones', 'showtimes', 'shows'].sort()
    );
    await client.close();
  });

  it('orders.type=ticket을 허용한다', async () => {
    const client = createClient({ url: ':memory:' });
    await applyMigrations(client as any);
    await expect(
      client.execute({
        sql: `insert into orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token) values (?,?,?,?,?,?,?,?,?,?,?)`,
        args: ['test-order-id', 'TKT-20260930-AAAAAAAA', 'ticket', 'pending', '홍길동', '01000000000', 'test@example.com', 10000, 0, 10000, 'tok'],
      })
    ).resolves.toBeDefined();
    await client.close();
  });
});
