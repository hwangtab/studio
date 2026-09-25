/** @jest-environment node */
/**
 * POST /api/bookings는 선점 전에 자원의 캘린더를 다시 읽는다.
 *
 * 슬롯 화면(GET /slots)은 표시일 뿐이라, 화면을 미리 열어 두었거나 API를 직접 부르면
 * 캘린더에만 적힌 일정을 뚫고 예약이 성립했다(2026-09-25 감사). 여기서 그 구멍을 고정한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/booking/gcal', () => ({
  ...jest.requireActual('../../../lib/booking/gcal'),
  fetchBusyRanges: jest.fn(),
}));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../pages/api/bookings';
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

const ENV_KEYS = ['BOOKING_GCAL_ID', 'PRACTICE_ROOM_GCAL_ID'] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
beforeEach(async () => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  (fetchBusyRanges as jest.Mock).mockReset();
  await client.execute('DELETE FROM bookings');
  await client.execute('DELETE FROM orders');
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

let dayOffset = 3;
const dateFor = (): string => new Date(Date.now() + dayOffset++ * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);

const post = async (body: Record<string, unknown>) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method: 'POST', body, headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] as { ok: boolean; code?: string; message?: string } };
};
const customer = { customerName: '홍길동', customerPhone: '01012345678', customerEmail: 'hong@example.com', refundPolicyAgreed: true };
const bookingCount = async () => Number((await client.execute('SELECT COUNT(*) c FROM bookings')).rows[0].c);

describe('POST /api/bookings — 캘린더 재확인', () => {
  it('연습실: 캘린더에만 적힌 일정과 겹치면 선점하지 않고 409 slot_taken', async () => {
    process.env.PRACTICE_ROOM_GCAL_ID = 'rooms-cal';
    const date = dateFor();
    (fetchBusyRanges as jest.Mock).mockResolvedValue([
      { start: new Date(`${date}T15:00:00+09:00`), end: new Date(`${date}T17:00:00+09:00`) },
    ]);
    const res = await post({ productId: 'practice-room-hourly', hours: 1, date, startHour: 15, ...customer });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('slot_taken');
    expect((fetchBusyRanges as jest.Mock).mock.calls[0][2]).toBe('practice-room');
    expect(await bookingCount()).toBe(0);
  });

  it('녹음실: 캘린더 일정과 겹치면 409, 비어 있으면 201로 선점한다', async () => {
    const date = dateFor();
    (fetchBusyRanges as jest.Mock).mockResolvedValueOnce([
      { start: new Date(`${date}T13:00:00+09:00`), end: new Date(`${date}T14:00:00+09:00`) },
    ]);
    const taken = await post({ productId: 'recording-pro', date, startHour: 12, ...customer });
    expect(taken.status).toBe(409);
    expect(await bookingCount()).toBe(0);

    (fetchBusyRanges as jest.Mock).mockResolvedValueOnce([]);
    const ok = await post({ productId: 'recording-pro', date, startHour: 16, ...customer });
    expect(ok.status).toBe(201);
    expect(await bookingCount()).toBe(1);
  });

  it('녹음실: 캘린더 조회가 실패하면 선점하지 않고 503 (fail-closed)', async () => {
    (fetchBusyRanges as jest.Mock).mockRejectedValue(new Error('freeBusy 조회 실패: 500'));
    const res = await post({ productId: 'recording-pro', date: dateFor(), startHour: 12, ...customer });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('calendar_unavailable');
    expect(await bookingCount()).toBe(0);
  });

  it('연습실: 캘린더 env가 없으면 읽지 않고 DB만으로 선점한다', async () => {
    (fetchBusyRanges as jest.Mock).mockRejectedValue(new Error('should not be called'));
    const res = await post({ productId: 'practice-room-hourly', hours: 1, date: dateFor(), startHour: 15, ...customer });
    expect(res.status).toBe(201);
    expect(fetchBusyRanges).not.toHaveBeenCalled();
  });
});
