/** @jest-environment node */
/**
 * 계약 목록의 `?status=` 딥링크 — 대시보드 "서명 대기 계약"·"종료 처리 필요 계약" 카드가 여는 목록.
 * 전체 목록은 최근 200건이라 오래된 건이 밀리면 카드 건수와 화면이 어긋나므로, 서버가 그 조건으로만 읽는다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn().mockResolvedValue({ ok: true }) }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../pages/admin/contracts/index';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
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
afterAll(() => client.close());
beforeEach(async () => {
  await client.execute('DELETE FROM contracts');
});

const insert = async (id: string, status: string, over: { endIso?: string; terminated?: boolean; createdIso?: string } = {}) => {
  await client.execute({
    sql: `INSERT INTO contracts (id, title, customer_name, customer_email, customer_phone, room_number,
            start_date, end_date, monthly_rent, deposit_amount, payment_day, content, status, sign_token, expires_at, terminated_at, created_at)
          VALUES (?, '계약', '박연주', 'p@x.y', '010', 'A-1', 0, ?, 1, 0, 5, '본문', ?, ?, ?, ?, ?)`,
    args: [
      id,
      EPOCH(over.endIso ?? '2099-01-01T00:00:00Z'),
      status,
      `st-${id}`,
      EPOCH('2099-02-01T00:00:00Z'),
      over.terminated ? EPOCH('2026-01-01T00:00:00Z') : null,
      EPOCH(over.createdIso ?? '2026-01-01T00:00:00Z'),
    ],
  });
};

type Result = { props: { contracts: Array<{ id: string }>; truncated: boolean; serverFilter?: string } };
const load = async (status?: string) => (await getServerSideProps({ query: status ? { status } : {} } as never)) as Result;
const ids = (r: Result) => r.props.contracts.map((c) => c.id).sort();

it('?status=sent는 발송 계약만 싣고, 최근 200건 밖의 오래된 건도 포함한다', async () => {
  await insert('old-sent', 'sent', { createdIso: '2020-01-01T00:00:00Z' });
  for (let i = 0; i < 205; i++) await insert(`d${i}`, 'draft');

  const r = await load('sent');

  expect(ids(r)).toEqual(['old-sent']);
  expect(r.props.serverFilter).toBe('sent');
  expect(r.props.truncated).toBe(false);
});

it('?status=termination은 서명됐고 종료일이 지났고 종료 처리 전인 계약만 싣는다', async () => {
  await insert('over', 'signed', { endIso: '2020-01-01T00:00:00Z' });
  await insert('future', 'signed', { endIso: '2099-01-01T00:00:00Z' });
  await insert('done', 'signed', { endIso: '2020-01-01T00:00:00Z', terminated: true });
  await insert('sent', 'sent', { endIso: '2020-01-01T00:00:00Z' });

  expect(ids(await load('termination'))).toEqual(['over']);
});

it('모르는 값은 무시하고 평소 목록을 연다', async () => {
  await insert('a', 'draft');
  await insert('b', 'signed');

  const r = await load('nope');

  expect(ids(r)).toEqual(['a', 'b']);
  expect(r.props.serverFilter).toBeUndefined();
});
