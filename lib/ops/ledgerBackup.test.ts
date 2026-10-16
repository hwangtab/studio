/** @jest-environment node */
import { gunzipSync } from 'node:zlib';

const put = jest.fn();
const list = jest.fn();
const del = jest.fn();
jest.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => put(...args),
  list: (...args: unknown[]) => list(...args),
  del: (...args: unknown[]) => del(...args),
}));

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { sql } from 'drizzle-orm';
// eslint-disable-next-line import/first
import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
// eslint-disable-next-line import/first
import { backupLedger, LEDGER_BACKUP_TABLES } from './ledgerBackup';

const NOW = new Date('2026-10-16T17:30:00Z');

beforeEach(() => {
  put.mockReset().mockImplementation(async (pathname: string) => ({ pathname }));
  list.mockReset().mockResolvedValue({ blobs: [] });
  del.mockReset().mockResolvedValue(undefined);
});

describe('backupLedger', () => {
  it('원장 표를 통째로 떠서 gzip JSON으로 올리고, 빌링키 원문·토큰은 싣지 않는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    await db.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_email, customer_phone, manage_token, item_amount, vat_amount, total_amount)
      VALUES ('o1','SNB-1','session','paid','홍길동','a@b.c','010','SECRET-MANAGE',100,10,110)`);
    await db.run(sql`INSERT INTO payments (id, order_id, payment_key) VALUES ('p1','o1','pk-1')`);
    await db.run(sql`INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key, manage_token, item_amount, vat_amount, total_amount, billing_day, status)
      VALUES ('s1','lesson','김수강','010','s@b.c','CUSTOMER-SECRET','MANAGE-SECRET',300000,30000,330000,5,'active')`);
    await db.run(sql`INSERT INTO billing_keys (id, subscription_id, billing_key, card_company, raw_response) VALUES ('bk1','s1','BILLING-SECRET','현대','{"billingKey":"BILLING-SECRET"}')`);

    const result = await backupLedger(NOW);

    expect(result.backupPath).toBe('ledger/backup/2026-10-16-17-30-00.json.gz');
    expect(result.rows).toMatchObject({ orders: 1, payments: 1, subscriptions: 1, billing_keys: 1, refunds: 0 });
    expect(result.missingTables).toEqual([]);
    expect(put).toHaveBeenCalledWith(expect.stringContaining('ledger/backup/'), expect.any(Buffer), expect.objectContaining({ access: 'private', contentType: 'application/gzip' }));

    const body = JSON.parse(gunzipSync(put.mock.calls[0][1] as Buffer).toString('utf8')) as { tables: Record<string, Array<Record<string, unknown>>> };
    expect(Object.keys(body.tables).sort()).toEqual([...LEDGER_BACKUP_TABLES].sort());
    expect(body.tables.orders[0]).toMatchObject({ order_no: 'SNB-1', customer_name: '홍길동' });
    expect(JSON.stringify(body)).not.toContain('SECRET');
    expect(body.tables.billing_keys[0]).toMatchObject({ card_company: '현대' });
    expect(body.tables.billing_keys[0]).not.toHaveProperty('billing_key');
    expect(body.tables.billing_keys[0]).not.toHaveProperty('raw_response');
  });

  it('28일 지난 백업만 지우고, 새 백업 쓰기가 실패하면 정리하지 않고 던진다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    list.mockResolvedValue({ blobs: [
      { url: 'u-old', pathname: 'ledger/backup/old.json.gz', uploadedAt: new Date('2026-09-01T00:00:00Z').toISOString() },
      { url: 'u-new', pathname: 'ledger/backup/new.json.gz', uploadedAt: new Date('2026-10-10T00:00:00Z').toISOString() },
    ] });
    const result = await backupLedger(NOW);
    expect(result.removedBackups).toBe(1);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('u-old');

    del.mockClear();
    put.mockRejectedValueOnce(new Error('blob down'));
    await expect(backupLedger(NOW)).rejects.toThrow('blob down');
    expect(del).not.toHaveBeenCalled();
  });

  it('운영 DB에 없는 표는 건너뛰고 결과에 적는다(미적용 마이그레이션에 백업이 죽지 않게)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    await db.run(sql`DROP TABLE software_orders`);
    const result = await backupLedger(NOW);
    expect(result.missingTables).toEqual(['software_orders']);
    expect(result.rows).not.toHaveProperty('software_orders');
  });
});
