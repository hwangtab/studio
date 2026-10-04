/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }) }));
jest.mock('../../../../lib/payments/windowOpen', () => ({ loadPaymentWindowOpen: jest.fn().mockResolvedValue(null) }));

/* eslint-disable import/first */
import { getServerSideProps } from '../../../../pages/admin/funding/[id]';
import { encryptField, FIELD_CRYPTO_KEY_ENV } from '../../../../lib/crypto/fieldCrypto';
/* eslint-enable import/first */

/**
 * 관리자 후원 상세 SSR — 계좌 입금 건. **환불 계좌번호(평문도 암호문도) props에 싣지 않는다** —
 * Pages Router는 props를 페이지 HTML(__NEXT_DATA__)에 박는다. 계좌번호는 "계좌 보기" API로만 나간다.
 */
const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let previousKey: string | undefined;

const insertOrder = async (id: string, status: string, name = '김후원', entrySource = 'online') => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, 'funding', ?, ?, '010', 'a@example.com', ?, 4545, 455, 5000)`,
    args: [id, `FND-${id}`, status, name, `tok-${id}`],
  });
  await client.execute({
    sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount,
            payment_method, hold_expires_at, entry_source, refund_requested_at)
          VALUES (?, ?, 'demo', 'mail', '감사 메일', 5000, 1, 0, 'bank_transfer', 1790000000, ?, ?)`,
    args: [`p-${id}`, id, entrySource, status === 'paid' ? 1790000000 : null],
  });
};

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
  previousKey = process.env[FIELD_CRYPTO_KEY_ENV];
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 4).toString('base64');
});
afterAll(() => {
  if (previousKey === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = previousKey;
  client.close();
});

it('환불 요청된 계좌 입금 건 — 은행명·예금주만 싣고 계좌번호는 싣지 않는다', async () => {
  await insertOrder('o1', 'paid');
  const enc = encryptField('123-456-7890123');
  await client.execute({
    sql: `INSERT INTO funding_refund_accounts (order_id, bank_name, account_number_enc, account_holder) VALUES ('o1', '국민은행', ?, '김부모')`,
    args: [enc],
  });
  const result = (await getServerSideProps({ query: { id: 'o1' } } as never)) as unknown as { props: Record<string, unknown> };
  expect(result.props.refundAccount).toMatchObject({ status: 'present', bankName: '국민은행', accountHolder: '김부모' });
  const serialized = JSON.stringify(result.props);
  expect(serialized).not.toContain('7890123');
  expect(serialized).not.toContain(enc);
});

it('같은 이름의 다른 입금 대기·취소 신청을 후보로 싣는다', async () => {
  await insertOrder('o2', 'pending');
  await insertOrder('o3', 'expired');
  await insertOrder('o4', 'pending', '다른 사람');
  const result = (await getServerSideProps({ query: { id: 'o2' } } as never)) as unknown as { props: { sameNameDeposits: Array<{ orderNo: string }>; pledge: { awaitingDeposit: boolean } } };
  expect(result.props.pledge.awaitingDeposit).toBe(true);
  expect(result.props.sameNameDeposits.map((c) => c.orderNo)).toEqual(['FND-o3']);
});
