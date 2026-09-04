/** @jest-environment node */

/**
 * 운영 점검이 "조용한 실패"를 실제로 잡는지 실제 SQLite(in-memory)에서 검증한다.
 *
 * 이 점검의 존재 이유가 "기록은 되는데 아무도 안 읽는다"이므로, 검사식이 잘못되어
 * 늘 0건을 돌려주면 있으나 마나다 — 그리고 그 고장은 조용하다(메일이 안 오는 것이
 * 정상 동작과 구분되지 않는다). 그래서 각 조건을 데이터로 한 번씩 켜 본다.
 *
 * 캘린더 점검은 외부 호출이라 모킹한다. 나머지는 실제 테이블에 대고 돌린다 —
 * mismatch 판정은 payments 테이블과의 exists 서브쿼리라 모킹으로는 드러나지 않는다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/gcal', () => ({ fetchBusyRanges: jest.fn() }));

// eslint-disable-next-line import/first
import { fetchBusyRanges } from '../booking/gcal';
// eslint-disable-next-line import/first
import { formatHealthReport, runHealthCheck } from './healthCheck';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-09-10T00:00:00Z');
const EPOCH = (d: string) => Math.floor(new Date(d).getTime() / 1000);

let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const text = readFileSync(path.join(MIGRATIONS, file), 'utf-8');
    for (const statement of text.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
});

beforeEach(async () => {
  for (const table of ['payments', 'bookings', 'orders', 'contracts']) {
    await client.execute(`DELETE FROM ${table}`);
  }
  (fetchBusyRanges as jest.Mock).mockReset().mockResolvedValue([]);
});

afterAll(() => {
  client.close();
});

const insertOrder = async (over: Record<string, unknown> = {}) => {
  const row = {
    id: 'o1',
    order_no: 'SNB-1',
    status: 'paid',
    customer_name: '홍길동',
    customer_email: 'a@b.c',
    customer_phone: '010-0000-0000',
    manage_token: 'tok',
    item_amount: 250000,
    vat_amount: 25000,
    total_amount: 275000,
    notification_error: null,
    created_at: EPOCH('2026-09-01'),
    updated_at: EPOCH('2026-09-01'),
    ...over,
  };
  const cols = Object.keys(row).join(', ');
  const marks = Object.keys(row).map(() => '?').join(', ');
  await client.execute({ sql: `INSERT INTO orders (${cols}) VALUES (${marks})`, args: Object.values(row) as never[] });
};

const insertBooking = async (over: Record<string, unknown> = {}) => {
  const row = {
    id: 'b1',
    order_id: 'o1',
    product_id: 'recording-pro',
    service_type: 'recording',
    status: 'confirmed',
    start_at: EPOCH('2026-09-20T05:00:00Z'),
    end_at: EPOCH('2026-09-20T08:00:00Z'),
    duration_hours: 3,
    gcal_error: null,
    created_at: EPOCH('2026-09-01'),
    updated_at: EPOCH('2026-09-01'),
    ...over,
  };
  const cols = Object.keys(row).join(', ');
  const marks = Object.keys(row).map(() => '?').join(', ');
  await client.execute({ sql: `INSERT INTO bookings (${cols}) VALUES (${marks})`, args: Object.values(row) as never[] });
};

const insertContract = async (over: Record<string, unknown> = {}) => {
  const row = {
    id: 'c1',
    title: '302호 이용계약',
    customer_name: '김고객',
    customer_email: 'c@d.e',
    customer_phone: '010-1111-2222',
    room_number: '302',
    start_date: EPOCH('2026-09-01'),
    end_date: EPOCH('2027-03-01'),
    monthly_rent: 300000,
    deposit_amount: 300000,
    payment_day: 1,
    content: '본문',
    status: 'signed',
    sign_token: 'st',
    expires_at: EPOCH('2026-09-30'),
    notification_error: null,
    created_at: EPOCH('2026-09-01'),
    updated_at: EPOCH('2026-09-01'),
    ...over,
  };
  const cols = Object.keys(row).join(', ');
  const marks = Object.keys(row).map(() => '?').join(', ');
  await client.execute({ sql: `INSERT INTO contracts (${cols}) VALUES (${marks})`, args: Object.values(row) as never[] });
};

const titles = async (): Promise<string[]> => (await runHealthCheck(NOW)).issues.map((i) => i.title);

describe('운영 점검', () => {
  it('아무 문제가 없으면 아무것도 보고하지 않는다 (메일이 안 가는 조건)', async () => {
    await insertOrder();
    await insertBooking();
    await insertContract();
    expect(await titles()).toEqual([]);
  });

  it('캘린더가 죽으면 예약 퍼널이 멈춘 것으로 보고한다', async () => {
    // 이 실패만 DB에 흔적이 없다 — 직접 찔러 보지 않으면 알 방법이 없다.
    (fetchBusyRanges as jest.Mock).mockRejectedValue(new Error('invalid_grant'));
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].severity).toBe('high');
    expect(issues[0].title).toContain('예약 캘린더');
    expect(issues[0].detail).toContain('invalid_grant');
  });

  it('캘린더 등록에 실패한 확정 예약을 잡는다 (오프라인 이중예약 위험)', async () => {
    await insertOrder();
    await insertBooking({ gcal_error: 'create: 500' });
    expect((await titles()).join()).toContain('구글 캘린더에 등록되지 않은 확정 예약 1건');
  });

  it('취소된 예약의 캘린더 오류는 세지 않는다 (이미 지나간 일)', async () => {
    await insertOrder();
    await insertBooking({ gcal_error: 'delete: 500', status: 'cancelled' });
    expect(await titles()).toEqual([]);
  });

  it('확인 메일이 실패한 예약을 주문번호와 함께 보고한다', async () => {
    await insertOrder({ notification_error: 'customer:TIMEOUT' });
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].title).toContain('확인 메일이 나가지 않은 예약 1건');
    expect(issues[0].detail).toContain('SNB-1');
  });

  it('돈은 들어왔는데 미결제로 남은 주문을 잡는다', async () => {
    await insertOrder({ status: 'failed' });
    await client.execute({
      sql: 'INSERT INTO payments (id, order_id, payment_key, created_at) VALUES (?,?,?,?)',
      args: ['p1', 'o1', 'pk', EPOCH('2026-09-01')],
    });
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].title).toContain('결제 기록과 주문 상태가 어긋난 주문 1건');
    expect(issues[0].severity).toBe('high');
  });

  it('결제 기록이 없는 실패 주문은 정상으로 본다 (고객 이탈은 사고가 아니다)', async () => {
    await insertOrder({ status: 'failed' });
    expect(await titles()).toEqual([]);
  });

  it('알림이 실패한 계약을 잡는다', async () => {
    await insertContract({ notification_error: 'PDF 생성 실패' });
    expect((await titles()).join()).toContain('알림이 나가지 않은 계약 1건');
  });

  it('서명 기한이 지난 미서명 계약을 잡는다', async () => {
    await insertContract({ status: 'sent', expires_at: EPOCH('2026-09-05') });
    expect((await titles()).join()).toContain('서명 기한이 지난 계약 1건');
  });

  it('기한이 남은 미서명 계약은 보고하지 않는다', async () => {
    await insertContract({ status: 'sent', expires_at: EPOCH('2026-09-30') });
    expect(await titles()).toEqual([]);
  });

  it('긴급 항목을 먼저 보여준다', async () => {
    await insertContract({ notification_error: 'x' });
    await insertOrder();
    await insertBooking({ gcal_error: 'create: 500' });
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].severity).toBe('high');
    expect(issues[issues.length - 1].severity).toBe('medium');
  });

  it('메일 본문에 무엇을 해야 하는지가 들어간다', async () => {
    await insertOrder();
    await insertBooking({ gcal_error: 'create: 500' });
    const text = formatHealthReport(await runHealthCheck(NOW));
    expect(text).toContain('[긴급]');
    expect(text).toContain('이 메일은 이상이 있을 때만 발송됩니다.');
  });
});
