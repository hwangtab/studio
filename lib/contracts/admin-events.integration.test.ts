/** @jest-environment node */
/**
 * 계약 변경 이력 — 실 DB(in-memory, 마이그레이션 0075). 표가 없는 환경에서도 변경이 실패하지 않아야 한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { listContractAdminEvents, recordContractChange } from './admin-events';

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
afterAll(() => client.close());
beforeEach(async () => {
  await client.execute('DELETE FROM contract_admin_events');
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('행위를 남기고 계약별로 최신순으로 읽는다', async () => {
  await recordContractChange({ contractId: 'c1', action: 'create', actor: 'kyungha', fromStatus: null, toStatus: 'draft' });
  await client.execute('UPDATE contract_admin_events SET at = at - 100');
  await recordContractChange({ contractId: 'c1', action: 'send', actor: 'minji', fromStatus: 'draft', toStatus: 'sent' });
  await recordContractChange({ contractId: 'other', action: 'cancel', actor: 'kyungha', fromStatus: 'draft', toStatus: 'cancelled' });

  const events = await listContractAdminEvents('c1');

  expect(events.map((e) => [e.action, e.actor, e.fromStatus, e.toStatus])).toEqual([
    ['send', 'minji', 'draft', 'sent'],
    ['create', 'kyungha', null, 'draft'],
  ]);
});

it('서버 로그에도 남긴다 — DB가 죽어도 행위자는 로그에 있다', async () => {
  await recordContractChange({ contractId: 'c1', action: 'terminate', actor: 'kyungha', fromStatus: 'signed', toStatus: 'terminated' });
  expect(console.warn).toHaveBeenCalledWith('[contracts] 관리자 작업 (contractId=c1, action=terminate, actor=kyungha)');
});

it('삭제한 계약의 이력도 남는다 — 계약 행에 매이지 않는다', async () => {
  await recordContractChange({ contractId: 'gone', action: 'delete', actor: 'kyungha', fromStatus: 'draft', toStatus: null });
  expect(await listContractAdminEvents('gone')).toHaveLength(1);
});

// 마이그레이션 전 배포 — 이력 표가 없어도 변경은 실패하지 않고 화면은 빈 목록을 그린다.
it('표가 없으면 던지지 않고(쓰기) 빈 목록을 돌려준다(읽기)', async () => {
  await client.execute('ALTER TABLE contract_admin_events RENAME TO contract_admin_events_x');
  try {
    await expect(
      recordContractChange({ contractId: 'c1', action: 'cancel', actor: 'kyungha', fromStatus: 'draft', toStatus: 'cancelled' }),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled(); // 로그는 남았다
    expect(await listContractAdminEvents('c1')).toEqual([]);
  } finally {
    await client.execute('ALTER TABLE contract_admin_events_x RENAME TO contract_admin_events');
  }
});

it('저장하는 칸에 이름·연락처 같은 개인정보가 없다', async () => {
  const cols = (await client.execute('PRAGMA table_info(contract_admin_events)')).rows.map((r) => String(r.name));
  expect(cols.sort()).toEqual(['action', 'actor', 'at', 'contract_id', 'from_status', 'id', 'to_status']);
});
