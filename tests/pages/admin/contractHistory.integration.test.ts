/** @jest-environment node */
/**
 * 계약 작업 이력 화면·CSV(실 DB). 필터가 화면과 CSV에서 같게 먹고, 표가 없으면 적용 방법을 알리며,
 * 개인정보(이름·연락처)를 싣지 않는다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  authenticateAdminRequest: jest.fn().mockResolvedValue({ ok: true }),
  authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }),
}));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSideProps } from '../../../pages/admin/contracts/history';
import exportHandler from '../../../pages/api/admin/contracts/history-export';
import { parseContractEventFilter } from '../../../lib/contracts/admin-events';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
/* eslint-enable import/first */

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
  await client.execute('DELETE FROM contract_admin_events');
  await client.execute('DELETE FROM contracts');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const insertContract = (id: string, room: string) =>
  client.execute({
    sql: `INSERT INTO contracts (id, title, customer_name, customer_email, customer_phone, room_number, start_date, end_date, monthly_rent,
            deposit_amount, payment_day, content, status, sign_token, expires_at)
          VALUES (?, '계약', '박연주', 'p@x.y', '010-1234-5678', ?, 0, 0, 1, 0, 5, '본문', 'signed', ?, 0)`,
    args: [id, room, `st-${id}`],
  });
const insertEvent = (contractId: string, action: string, actor: string, at: string, from: string | null, to: string | null) =>
  client.execute({
    sql: 'INSERT INTO contract_admin_events (id, contract_id, action, actor, from_status, to_status, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [`${contractId}-${action}-${at}`, contractId, action, actor, from, to, EPOCH(at)],
  });

const load = async (query: Record<string, string> = {}) =>
  (await getServerSideProps({ query } as never)) as { props: { events: Array<{ contractId: string; action: string; actor: string; roomNumber: string | null }>; truncated: boolean; error?: string; actors: string[] } };

const seed = async () => {
  await insertContract('c1', 'A-1');
  await insertEvent('c1', 'send', 'kyungha', '2026-10-10T01:00:00Z', 'draft', 'sent');
  await insertEvent('c1', 'terminate', 'minji', '2026-10-14T01:00:00Z', 'signed', 'terminated');
  await insertEvent('gone', 'delete', 'kyungha', '2026-10-12T01:00:00Z', 'draft', null); // 삭제된 계약 — 계약 행 없음
};

describe('화면', () => {
  it('최신순으로 싣고, 삭제된 계약은 호실이 null이다', async () => {
    await seed();
    const { props } = await load();
    expect(props.events.map((e) => [e.action, e.actor, e.roomNumber])).toEqual([
      ['terminate', 'minji', 'A-1'],
      ['delete', 'kyungha', null],
      ['send', 'kyungha', 'A-1'],
    ]);
    expect(props.actors).toEqual(['kyungha', 'minji']);
  });

  it('수행자·행위·기간(KST 양 끝 포함)·계약 id로 거른다', async () => {
    await seed();
    expect((await load({ actor: 'minji' })).props.events.map((e) => e.action)).toEqual(['terminate']);
    expect((await load({ action: 'send' })).props.events.map((e) => e.action)).toEqual(['send']);
    expect((await load({ contract: 'gone' })).props.events.map((e) => e.action)).toEqual(['delete']);
    // 10/12 KST 10:00에 삭제 — 하루 구간의 양 끝(from=to)에 걸려도 포함된다.
    expect((await load({ from: '2026-10-12', to: '2026-10-12' })).props.events.map((e) => e.action)).toEqual(['delete']);
    expect((await load({ from: '2026-10-13' })).props.events.map((e) => e.action)).toEqual(['terminate']);
  });

  it('이름·연락처는 싣지 않는다', async () => {
    await seed();
    expect(JSON.stringify((await load()).props)).not.toMatch(/박연주|010-1234|p@x\.y/);
  });

  it('200건을 넘으면 잘렸다고 알린다', async () => {
    await insertContract('c1', 'A-1');
    for (let i = 0; i < 201; i++) await insertEvent('c1', 'update', 'kyungha', `2026-10-01T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`, 'draft', 'draft');
    const { props } = await load();
    expect(props.events).toHaveLength(200);
    expect(props.truncated).toBe(true);
  });

  it('표가 없으면(마이그레이션 전) 적용 방법을 알린다', async () => {
    await client.execute('ALTER TABLE contract_admin_events RENAME TO contract_admin_events_x');
    try {
      const { props } = await load();
      expect(props.error).toContain('0060');
      expect(props.events).toEqual([]);
    } finally {
      await client.execute('ALTER TABLE contract_admin_events_x RENAME TO contract_admin_events');
    }
  });
});

describe('CSV', () => {
  const download = async (query: Record<string, string> = {}) => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send, json: jest.fn() });
    const headers: Record<string, string> = {};
    await exportHandler(
      { method: 'GET', query, headers: {} } as unknown as NextApiRequest,
      { setHeader: (k: string, v: string) => (headers[k] = v), status } as unknown as NextApiResponse,
    );
    return { status: status.mock.calls[0][0] as number, body: String(send.mock.calls[0]?.[0] ?? ''), headers };
  };

  it('화면과 같은 필터로 내려받고 한글이 깨지지 않게 BOM을 붙인다', async () => {
    await seed();
    const r = await download({ actor: 'minji' });
    expect(r.status).toBe(200);
    expect(r.headers['Content-Type']).toContain('text/csv');
    expect(r.body.startsWith('﻿일시(KST),계약 ID,호실,행위,수행자,이전 상태,이후 상태')).toBe(true);
    const lines = r.body.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-10-14 10:00:00,c1,A-1,이용 종료 처리,minji,서명완료,이용종료');
  });

  it('개인정보가 없다', async () => {
    await seed();
    expect((await download()).body).not.toMatch(/박연주|010-1234|p@x\.y/);
  });

  it('인증이 없으면 401', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValueOnce({ ok: false });
    expect((await download()).status).toBe(401);
  });
});

describe('parseContractEventFilter', () => {
  it('모르는 행위·형식이 틀린 날짜는 무시하고, 프로토타입 키도 행위로 받지 않는다', () => {
    expect(parseContractEventFilter({ action: 'toString', from: '내일', to: '2026-13-99x' }, 10)).toEqual({
      actor: undefined, action: undefined, contractId: undefined, from: undefined, to: undefined, limit: 10,
    });
    expect(parseContractEventFilter({ action: 'cancel', from: '2026-10-01', actor: ['a', 'b'] }, 5)).toMatchObject({
      action: 'cancel', from: '2026-10-01', actor: undefined,
    });
  });
});
