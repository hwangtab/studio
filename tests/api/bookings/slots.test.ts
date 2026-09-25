/** @jest-environment node */
/**
 * 슬롯 API의 캘린더 규칙을 고정한다 — 녹음실·연습실이 같은 기준으로 자기 캘린더를 읽는다.
 *
 * - 캘린더 조회 실패는 fail-closed(503). 녹음실은 BOOKING_GCAL_ID가 없어도 503이다 —
 *   PR #246 직후 한때 env가 비면 캘린더 없이 통과(fail-open)했다. 여기서 막는다.
 * - 연습실 캘린더(PRACTICE_ROOM_GCAL_ID)만 env가 없으면 읽지 않는다(confirm.ts가 같은
 *   조건으로 쓰기를 건너뛰므로 짝을 맞춘다). env가 있으면 그 바쁨이 방 전체 슬롯을 막는다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/gcal', () => ({
  ...jest.requireActual('../../../lib/booking/gcal'),
  fetchBusyRanges: jest.fn(),
}));
// 방이 둘인 상황을 만든다 — 운영 상수는 R02 하나라 방별 캘린더 분기를 테스트할 수 없다.
jest.mock('../../../lib/booking/products', () => {
  const actual = jest.requireActual('../../../lib/booking/products');
  const twoRooms = { ...actual.getProduct('practice-room-hourly'), rooms: ['R02', 'R05'] };
  return { ...actual, getProduct: (id: string) => (id === 'practice-room-hourly' ? twoRooms : actual.getProduct(id)) };
});

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../pages/api/bookings/slots';
// eslint-disable-next-line import/first
import { fetchBusyRanges } from '../../../lib/booking/gcal';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
});
afterAll(() => client.close());

const ENV_KEYS = ['BOOKING_GCAL_ID', 'PRACTICE_ROOM_GCAL_ID', 'PRACTICE_ROOM_GCAL_ID_R05'] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  (fetchBusyRanges as jest.Mock).mockReset();
  // 캐시가 인스턴스 메모리라 테스트 간 오염을 막기 위해 날짜를 매번 다르게 쓴다(아래 dateFor).
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

let dayOffset = 2;
/** KST 기준 며칠 뒤 날짜. 테스트마다 다른 날짜를 써서 freeBusy 캐시 키가 겹치지 않게 한다. */
const dateFor = (): string => {
  const d = new Date(Date.now() + dayOffset++ * 86_400_000 + 9 * 3_600_000);
  return d.toISOString().slice(0, 10);
};

const call = async (query: Record<string, string>) => {
  const res = { statusCode: 0, body: undefined as unknown, setHeader: jest.fn() } as unknown as NextApiResponse & { body: unknown };
  (res as unknown as { status: (c: number) => typeof res }).status = (c: number) => { res.statusCode = c; return res; };
  (res as unknown as { json: (b: unknown) => typeof res }).json = (b: unknown) => { res.body = b; return res; };
  await handler({ method: 'GET', query } as unknown as NextApiRequest, res);
  return res;
};

describe('slots API — 캘린더 규칙', () => {
  it('녹음실: BOOKING_GCAL_ID가 없어도 캘린더 없이 통과하지 않는다 (503, fail-closed)', async () => {
    (fetchBusyRanges as jest.Mock).mockRejectedValue(new Error('BOOKING_GCAL_ID가 설정되지 않았습니다.'));
    const res = await call({ productId: 'recording-pro', date: dateFor() });
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, code: 'calendar_unavailable' });
    expect((fetchBusyRanges as jest.Mock).mock.calls[0][2]).toBe('studio');
  });

  it('연습실: PRACTICE_ROOM_GCAL_ID가 없으면 캘린더를 읽지 않고 DB만으로 응답한다', async () => {
    (fetchBusyRanges as jest.Mock).mockRejectedValue(new Error('should not be called'));
    const res = await call({ productId: 'practice-room-hourly', date: dateFor(), hours: '1' });
    expect(res.statusCode).toBe(200);
    expect(fetchBusyRanges).not.toHaveBeenCalled();
  });

  it('연습실: env가 있으면 자기 캘린더를 읽고, 그 바쁨이 슬롯을 막는다', async () => {
    process.env.PRACTICE_ROOM_GCAL_ID = 'rooms-cal';
    const date = dateFor();
    (fetchBusyRanges as jest.Mock).mockResolvedValue([
      { start: new Date(`${date}T15:00:00+09:00`), end: new Date(`${date}T16:00:00+09:00`) },
    ]);
    const res = await call({ productId: 'practice-room-hourly', date, hours: '1' });
    expect(res.statusCode).toBe(200);
    expect((fetchBusyRanges as jest.Mock).mock.calls[0][2]).toBe('practice-room');
    const slots = (res.body as { slots: Array<{ startHour: number; available: boolean }> }).slots;
    expect(slots.find((s) => s.startHour === 15)?.available).toBe(false);
    expect(slots.find((s) => s.startHour === 14)?.available).toBe(true);
    expect(slots.find((s) => s.startHour === 16)?.available).toBe(true);
  });

  it('연습실: env가 있고 캘린더 조회가 실패하면 녹음실과 같이 503', async () => {
    process.env.PRACTICE_ROOM_GCAL_ID = 'rooms-cal';
    (fetchBusyRanges as jest.Mock).mockRejectedValue(new Error('freeBusy 조회 실패: 500'));
    const res = await call({ productId: 'practice-room-hourly', date: dateFor(), hours: '1' });
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, code: 'calendar_unavailable' });
  });

  it('방별 캘린더: R05 캘린더의 일정은 R05만 막고 R02가 비어 있으면 슬롯은 가능', async () => {
    process.env.PRACTICE_ROOM_GCAL_ID = 'shared-cal';
    process.env.PRACTICE_ROOM_GCAL_ID_R05 = 'r05-cal';
    const date = dateFor();
    (fetchBusyRanges as jest.Mock).mockImplementation(async (_a: Date, _b: Date, _c: string, room?: string | null) =>
      room === 'R05' ? [{ start: new Date(`${date}T15:00:00+09:00`), end: new Date(`${date}T16:00:00+09:00`) }] : []);
    const res = await call({ productId: 'practice-room-hourly', date, hours: '1' });
    expect(res.statusCode).toBe(200);
    const rooms = (fetchBusyRanges as jest.Mock).mock.calls.map((c) => c[3]).sort();
    expect(rooms).toEqual(['R02', 'R05']);
    const slots = (res.body as { slots: Array<{ startHour: number; available: boolean }> }).slots;
    expect(slots.find((s) => s.startHour === 15)?.available).toBe(true);
  });

  it('공용 캘린더의 일정은 방별 캘린더가 없는 방 전부를 막는다', async () => {
    process.env.PRACTICE_ROOM_GCAL_ID = 'shared-cal';
    const date = dateFor();
    (fetchBusyRanges as jest.Mock).mockResolvedValue([
      { start: new Date(`${date}T15:00:00+09:00`), end: new Date(`${date}T16:00:00+09:00`) },
    ]);
    const res = await call({ productId: 'practice-room-hourly', date, hours: '1' });
    const slots = (res.body as { slots: Array<{ startHour: number; available: boolean }> }).slots;
    expect(slots.find((s) => s.startHour === 15)?.available).toBe(false);
  });
});
