/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { classifyPaymentBrowser, loadPaymentWindowOpen, recordPaymentWindowOpen } from './windowOpen';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
beforeEach(async () => {
  await client.execute('DELETE FROM payment_window_opens');
  await client.execute('DELETE FROM orders');
  await client.execute(`INSERT INTO orders (id, order_no, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token, status)
    VALUES ('o1', 'FND-20260929-AAAAAAAA', 'funding', 'n', 'p', 'e', 1, 0, 1, 't1', 'pending'),
           ('o2', 'FND-20260929-BBBBBBBB', 'funding', 'n', 'p', 'e', 1, 0, 1, 't2', 'paid')`);
});
afterAll(() => client.close());

const KAKAO = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0';

describe('classifyPaymentBrowser', () => {
  it('인앱 표식을 모바일보다 먼저 본다', () => {
    expect(classifyPaymentBrowser(KAKAO)).toBe('kakaotalk');
    expect(classifyPaymentBrowser('Mozilla/5.0 (iPhone) Instagram 300.0')).toBe('instagram');
    expect(classifyPaymentBrowser('Mozilla/5.0 (iPhone) Mobile Safari')).toBe('mobile');
    expect(classifyPaymentBrowser('Mozilla/5.0 (Macintosh) Safari')).toBe('desktop');
    expect(classifyPaymentBrowser(undefined)).toBe('desktop');
  });
});

describe('recordPaymentWindowOpen', () => {
  it('결제 대기 주문에 첫 기록을 남기고, 다시 열면 횟수·마지막 시각만 늘린다', async () => {
    expect(await recordPaymentWindowOpen({ orderNo: 'fnd-20260929-aaaaaaaa', userAgent: KAKAO, now: new Date('2026-09-29T00:00:00Z') })).toBe(true);
    expect(await recordPaymentWindowOpen({ orderNo: 'FND-20260929-AAAAAAAA', userAgent: 'iPhone Mobile', now: new Date('2026-09-29T00:01:00Z') })).toBe(true);
    const r = await loadPaymentWindowOpen('o1');
    expect(r).toEqual({
      firstOpenedAt: '2026-09-29T00:00:00.000Z', lastOpenedAt: '2026-09-29T00:01:00.000Z', openCount: 2, browserLabel: '모바일 브라우저',
    });
  });

  it('결제 대기가 아닌 주문·형식이 틀린 주문번호에는 적지 않는다', async () => {
    expect(await recordPaymentWindowOpen({ orderNo: 'FND-20260929-BBBBBBBB', userAgent: KAKAO })).toBe(false);
    expect(await recordPaymentWindowOpen({ orderNo: 'not-an-order', userAgent: KAKAO })).toBe(false);
    expect(await loadPaymentWindowOpen('o2')).toBeNull();
  });
});
