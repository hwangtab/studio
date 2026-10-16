/** @jest-environment node */
/** 월 입주 서비스 — 실 DB(in-memory libSQL)와 캘린더 목으로: 등록·입금·퇴실·중복 방·암호화·캘린더 투영·시트 가져오기. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/gcal', () => ({
  createEventOnCalendar: jest.fn(),
  patchEventOnCalendar: jest.fn(),
  deleteEventOnCalendar: jest.fn(),
}));

/* eslint-disable import/first */
import { createEventOnCalendar, deleteEventOnCalendar, patchEventOnCalendar } from '../booking/gcal';
import { importTenancySheet } from './importService';
import { openPrivate } from './privateData';
import { parseTenancyInput } from './rules';
import { createTenancy, endTenancy, listTenancies, recordPayment, reopenTenancy, updateTenancy } from './service';
import { syncTenancyCalendar } from './calendar';
/* eslint-enable import/first */

let client: Client;
const one = async (q: string) => (await client.execute(q)).rows[0] as Record<string, unknown> | undefined;

beforeAll(async () => {
  process.env.FUNDING_FIELD_KEY = randomBytes(32).toString('base64');
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(path.join(process.cwd(), 'drizzle/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(process.cwd(), 'drizzle/migrations', file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  for (const t of ['room_tenancy_payments', 'room_tenancies', 'contracts']) await client.execute(`DELETE FROM ${t}`);
  jest.resetAllMocks();
  process.env.TENANCY_GCAL_ID = 'cal-tenancy';
  (createEventOnCalendar as jest.Mock).mockResolvedValueOnce('evt-due').mockResolvedValueOnce('evt-end').mockResolvedValue('evt-more');
  (patchEventOnCalendar as jest.Mock).mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const input = (over: Record<string, unknown> = {}) => {
  const p = parseTenancyInput({
    kind: 'room', roomNumber: 'R05', tenantName: '조현정', monthlyAmount: 360000, startDate: '2026-10-14', nextDueOn: '2026-11-14', endDate: '2099-01-01',
    private: { phone: '010-1111-2222', gender: '여' }, ...over,
  });
  if (!p.ok) throw new Error(p.message);
  return p.value;
};

describe('createTenancy', () => {
  it('개인정보는 암호문으로만 저장되고 열면 복원된다', async () => {
    const r = await createTenancy(input());
    if (!r.ok) throw new Error(r.message);
    const row = await one(`SELECT private_enc, tenant_name FROM room_tenancies WHERE id = '${r.id}'`);
    expect(String(row?.private_enc)).toMatch(/^v2:/);
    expect(String(row?.private_enc)).not.toContain('010-1111');
    expect(openPrivate(row?.private_enc as string)).toEqual({ phone: '010-1111-2222', gender: '여' });
    const list = await listTenancies();
    expect(JSON.stringify(list)).not.toContain('010-1111');
    expect(list[0]).toMatchObject({ hasPrivate: true, tenantName: '조현정' });
  });

  it('같은 방에 입주 중인 사람이 있으면 거절하고, 비상주는 방과 무관하다', async () => {
    expect((await createTenancy(input())).ok).toBe(true);
    expect(await createTenancy(input({ tenantName: '다른 사람' }))).toMatchObject({ ok: false });
    expect((await createTenancy(input({ kind: 'virtual', roomNumber: null, tenantName: '회사' }))).ok).toBe(true);
  });

  it('캘린더에 입금 예정·계약 종료 일정을 올리고 id를 저장한다', async () => {
    const r = await createTenancy(input());
    if (!r.ok) throw new Error(r.message);
    expect(createEventOnCalendar).toHaveBeenCalledWith('cal-tenancy', expect.objectContaining({ summary: expect.stringContaining('[입금 예정] R05 조현정'), start: { date: '2026-11-14' }, end: { date: '2026-11-15' }, transparency: 'transparent' }));
    expect(await one(`SELECT due_event_id, end_event_id FROM room_tenancies WHERE id = '${r.id}'`)).toEqual({ due_event_id: 'evt-due', end_event_id: 'evt-end' });
  });

  it('캘린더가 실패해도 등록은 되고 오류를 남긴다', async () => {
    (createEventOnCalendar as jest.Mock).mockReset().mockRejectedValue(new Error('down'));
    const r = await createTenancy(input());
    expect(r).toMatchObject({ ok: true, calendarError: 'down' });
    if (r.ok) expect(String((await one(`SELECT gcal_error FROM room_tenancies WHERE id = '${r.id}'`))?.gcal_error)).toContain('down');
  });

  it('전용 캘린더가 없으면 연습실 캘린더를 쓰고, 둘 다 없으면 건너뛴다', async () => {
    delete process.env.TENANCY_GCAL_ID;
    process.env.PRACTICE_ROOM_GCAL_ID = 'cal-practice';
    await createTenancy(input({ tenantName: '연습실캘린더' , roomNumber: 'R06' }));
    expect(createEventOnCalendar).toHaveBeenCalledWith('cal-practice', expect.anything());
    jest.mocked(createEventOnCalendar).mockClear();
    delete process.env.PRACTICE_ROOM_GCAL_ID;
    const r = await createTenancy(input());
    expect(r).toMatchObject({ ok: true, calendarError: null });
    expect(createEventOnCalendar).not.toHaveBeenCalled();
  });
});

describe('recordPayment', () => {
  it('입금 예정일을 한 달 넘기고 일정을 옮기며 이력을 남긴다', async () => {
    const r = await createTenancy(input());
    if (!r.ok) throw new Error(r.message);
    const p = await recordPayment(r.id, { paidOn: '2026-11-13' });
    expect(p).toMatchObject({ ok: true, nextDueOn: '2026-12-14' });
    expect(patchEventOnCalendar).toHaveBeenCalledWith('cal-tenancy', 'evt-due', expect.objectContaining({ start: { date: '2026-12-14' } }));
    expect(await one(`SELECT paid_on, amount, for_due_on FROM room_tenancy_payments`)).toEqual({ paid_on: '2026-11-13', amount: 360000, for_due_on: '2026-11-14' });
  });

  it('말일 납부일은 달 길이에 맞춘다', async () => {
    const r = await createTenancy(input({ nextDueOn: '2026-01-31', billingDay: 31 }));
    if (!r.ok) throw new Error(r.message);
    expect(await recordPayment(r.id, { paidOn: '2026-01-31' })).toMatchObject({ nextDueOn: '2026-02-28' });
    expect(await recordPayment(r.id, { paidOn: '2026-02-28' })).toMatchObject({ nextDueOn: '2026-03-31' });
  });

  it('퇴실한 사람에게는 기록하지 않는다', async () => {
    const r = await createTenancy(input());
    if (!r.ok) throw new Error(r.message);
    await endTenancy(r.id, '2026-12-01');
    expect(await recordPayment(r.id, {})).toMatchObject({ ok: false });
  });
});

describe('endTenancy / reopenTenancy', () => {
  it('퇴실하면 일정을 지우고 방이 비며, 되돌릴 때 그새 다른 사람이 들어왔으면 거절한다', async () => {
    const a = await createTenancy(input());
    if (!a.ok) throw new Error(a.message);
    expect(await endTenancy(a.id, '2026-12-01')).toMatchObject({ ok: true });
    expect(deleteEventOnCalendar).toHaveBeenCalledWith('cal-tenancy', 'evt-due');
    expect(deleteEventOnCalendar).toHaveBeenCalledWith('cal-tenancy', 'evt-end');
    expect(await one(`SELECT due_event_id, end_event_id, status FROM room_tenancies WHERE id = '${a.id}'`)).toEqual({ due_event_id: null, end_event_id: null, status: 'ended' });
    const b = await createTenancy(input({ tenantName: '새 사람' }));
    expect(b.ok).toBe(true);
    expect(await reopenTenancy(a.id)).toMatchObject({ ok: false });
  });
});

describe('updateTenancy', () => {
  it('상세를 열지 않고 저장하면(keepPrivate) 암호문을 그대로 둔다', async () => {
    const r = await createTenancy(input());
    if (!r.ok) throw new Error(r.message);
    const before = (await one(`SELECT private_enc FROM room_tenancies WHERE id = '${r.id}'`))?.private_enc;
    expect(await updateTenancy(r.id, input({ private: {}, monthlyAmount: 370000 }), { keepPrivate: true })).toMatchObject({ ok: true });
    const after = await one(`SELECT private_enc, monthly_amount FROM room_tenancies WHERE id = '${r.id}'`);
    expect(after).toEqual({ private_enc: before, monthly_amount: 370000 });
    await updateTenancy(r.id, input({ private: { phone: '010-9999-9999' } }), { keepPrivate: false });
    expect(openPrivate((await one(`SELECT private_enc FROM room_tenancies WHERE id = '${r.id}'`))?.private_enc as string)).toEqual({ phone: '010-9999-9999' });
  });

  it('계약 종료일이 지난 입주자는 종료 일정을 만들지 않는다(자동 연장)', async () => {
    const r = await createTenancy(input({ endDate: '2026-04-25' }));
    if (!r.ok) throw new Error(r.message);
    expect(createEventOnCalendar).toHaveBeenCalledTimes(1);
    expect(await syncTenancyCalendar(r.id, new Date('2026-10-16T00:00:00Z'))).toEqual({ ok: true });
  });
});

describe('importTenancySheet', () => {
  const SHEET = [
    '방,가격,창,피아노,이름, 계약액,연체여부,대여시작일,종료일확인,계약종료일,최종입금일,최종입금액,입금예정일,전화번호,성별,비상연락, 보증금,특약',
    'R05,,X,아이맥,조현정,"₩360,000",,2026-10-14,,,2026-10-14,"₩360,000",2026-11-14,,여,,,',
    '비대면,,,,주식회사 가,"₩33,000",,2026-02-26,,2027-02-25,2026-09-10,"₩33,000",2026-10-26,010-0000-0002,,a@b.kr,,111-11-11111',
  ].join('\n');

  it('전화번호가 없는 사람은 전자계약에서 이름으로 찾아 채우고, 다시 돌려도 중복되지 않는다', async () => {
    await mockDb.insert(schema.contracts).values({
      id: 'c1', title: '입주 계약', customerName: '조현정', customerEmail: 'x@y.z', customerPhone: '010-5696-0000', roomNumber: 'R05',
      startDate: new Date('2026-10-14'), endDate: new Date('2027-10-13'), monthlyRent: 360000, depositAmount: 360000, content: 'x', status: 'signed', signToken: 'tok-c1', expiresAt: new Date('2099-01-01'),
    });
    const first = await importTenancySheet(SHEET);
    expect(first).toMatchObject({ created: 2, skippedExisting: 0, phoneFilledFromContract: ['조현정'], problems: [] });
    const row = await one(`SELECT private_enc, contract_id FROM room_tenancies WHERE tenant_name = '조현정'`);
    expect(row?.contract_id).toBe('c1');
    expect((await one(`SELECT deposit_amount FROM room_tenancies WHERE tenant_name = '조현정'`))?.deposit_amount).toBe(360000);
    expect(openPrivate(row?.private_enc as string)).toMatchObject({ phone: '010-5696-0000', gender: '여' });
    expect(await importTenancySheet(SHEET)).toMatchObject({ created: 0, skippedExisting: 2 });
    expect(await one(`SELECT COUNT(*) AS n FROM room_tenancy_payments`)).toEqual({ n: 2 });
  });
});
