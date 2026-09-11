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
  for (const table of ['payments', 'bookings', 'funding_pledges', 'orders', 'contracts']) {
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
    // 정상 확정 예약은 캘린더 이벤트 id를 갖는다 — 확정 배치 직후 ensureBookingEvent가
    // event_id 또는 gcal_error 중 하나를 반드시 채운다(lib/booking/confirm.ts). 둘 다 NULL인
    // 상태 자체가 사고이므로, "아무 문제 없음" 기준선은 event id가 있는 쪽이다.
    gcal_event_id: 'ev-1',
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

/** 무통장 후원 한 건 + 취소 요청 시각. 주문 상태는 인자로 받은 값 그대로 둔다. */
const insertFundingPledge = async (over: Record<string, unknown> = {}) => {
  const row = {
    id: 'fp1',
    order_id: 'o1',
    project_slug: 'demo',
    reward_id: 'cd',
    reward_title: 'CD',
    unit_amount: 30000,
    quantity: 1,
    additional_amount: 0,
    payment_method: 'bank_transfer',
    hold_expires_at: EPOCH('2026-09-05'),
    refund_requested_at: null,
    created_at: EPOCH('2026-09-01'),
    updated_at: EPOCH('2026-09-01'),
    ...over,
  };
  const cols = Object.keys(row).join(', ');
  const marks = Object.keys(row).map(() => '?').join(', ');
  await client.execute({ sql: `INSERT INTO funding_pledges (${cols}) VALUES (${marks})`, args: Object.values(row) as never[] });
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
    await insertBooking({ gcal_error: 'create: 500', gcal_event_id: null });
    expect((await titles()).join()).toContain('구글 캘린더에 등록되지 않은 확정 예약 1건');
  });

  /**
   * PR #65가 확정 후처리 소유권을 센티널 CAS 선점으로 바꾸면서 생긴 사각지대를 재현한다.
   * 선점(notification_error='send_inflight')에 성공한 실행이 ensureBookingEvent **전에**
   * 죽으면 gcal_event_id·gcal_error가 둘 다 NULL로 남는다. 예전 조건
   * (`gcal_error IS NOT NULL`)은 이 예약을 영원히 못 잡았고, 그 사이 운영자가 알림 배너를
   * 보고 "알림 재발송"을 누르면 센티널까지 지워져 무증상 이중예약이 됐다.
   */
  it('선점 직후·캘린더 등록 전에 죽은 확정 예약을 잡는다 (오류 기록조차 없는 구멍)', async () => {
    await insertOrder({ notification_error: 'send_inflight' });
    await insertBooking({ gcal_event_id: null, gcal_error: null });
    const issues = (await runHealthCheck(NOW)).issues;
    const gcal = issues.find((i) => i.title.includes('구글 캘린더'));
    expect(gcal).toBeDefined();
    expect(gcal!.title).toContain('확정 예약 1건');
    expect(gcal!.detail).toContain('등록 시도 자체가 없음: 1건');
    expect(gcal!.detail).not.toContain('시도했다가 실패');
  });

  // 운영자가 배너 지시대로 "알림 재발송"을 눌러 센티널이 지워져도 캘린더 구멍은 계속 보여야
  // 한다 — 그 덮어쓰기가 유일한 신호를 지우던 것이 이 점검을 넣은 이유다.
  it('센티널이 지워져도 캘린더 구멍은 계속 보고한다', async () => {
    await insertOrder({ notification_error: null });
    await insertBooking({ gcal_event_id: null, gcal_error: null });
    expect((await titles()).join()).toContain('구글 캘린더에 등록되지 않은 확정 예약 1건');
  });

  // 한 예약이 "등록 실패"와 "이벤트 없음" 양쪽에 해당해도 한 번만 센다 — 두 건으로 세면
  // 운영자가 규모를 오해한다.
  it('등록 실패와 이벤트 없음이 겹친 예약을 두 번 세지 않는다', async () => {
    await insertOrder();
    await insertBooking({ gcal_event_id: null, gcal_error: 'create: 500' });
    const gcal = (await runHealthCheck(NOW)).issues.find((i) => i.title.includes('구글 캘린더'))!;
    expect(gcal.title).toContain('확정 예약 1건');
    expect(gcal.detail).toContain('등록을 시도했다가 실패: 1건');
    expect(gcal.detail).not.toContain('등록 시도 자체가 없음');
  });

  // 믹싱·마스터링 주문은 bookings 행이 아예 없다 — 캘린더 점검에 걸릴 일이 없어야 한다.
  it('믹싱 주문(bookings 행 없음)은 캘린더 점검에 걸리지 않는다', async () => {
    await insertOrder({ type: 'mixing', notification_error: 'send_inflight' });
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues.some((i) => i.title.includes('구글 캘린더에 등록되지 않은'))).toBe(false);
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

  /**
   * 무통장 청약철회는 자동 환불 경로가 없어 orders.status가 paid로 남는다 — 이 점검이
   * 없으면 약관 제10조의 3영업일 기한을 아무 알림 없이 넘긴다.
   */
  it('48시간이 지난 취소 요청을 긴급으로 보고한다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'paid' });
    await insertFundingPledge({ refund_requested_at: EPOCH('2026-09-07T00:00:00Z') }); // NOW − 72h
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].severity).toBe('high');
    expect(issues[0].title).toContain('환불 기한이 임박한 취소 요청 1건');
    expect(issues[0].detail).toContain('FND-1');
  });

  it('48시간이 안 지난 취소 요청은 대기 항목으로만 알린다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'paid' });
    await insertFundingPledge({ refund_requested_at: EPOCH('2026-09-09T12:00:00Z') }); // NOW − 12h
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('medium');
    expect(issues[0].title).toContain('계좌 환불을 기다리는 취소 요청 1건');
  });

  // 잔액이 남은 부분환불 건에서 알람이 꺼지면, 덜 돌려준 돈이 조용히 묻힌다.
  it('partially_refunded 건도 계속 센다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'partially_refunded' });
    await insertFundingPledge({ refund_requested_at: EPOCH('2026-09-07T00:00:00Z') });
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].severity).toBe('high');
    expect(issues[0].detail).toContain('FND-1');
  });

  it('이미 환불된 건과 요청이 없는 건은 보고하지 않는다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'refunded' });
    await insertFundingPledge({ refund_requested_at: EPOCH('2026-09-01T00:00:00Z') });
    await insertOrder({ id: 'o2', order_no: 'FND-2', status: 'paid', manage_token: 'tok2' });
    await insertFundingPledge({ id: 'fp2', order_id: 'o2' });
    expect(await titles()).toEqual([]);
  });

  it('긴급 항목을 먼저 보여준다', async () => {
    await insertContract({ notification_error: 'x' });
    await insertOrder();
    await insertBooking({ gcal_error: 'create: 500', gcal_event_id: null });
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].severity).toBe('high');
    expect(issues[issues.length - 1].severity).toBe('medium');
  });

  it('메일 본문에 무엇을 해야 하는지가 들어간다', async () => {
    await insertOrder();
    await insertBooking({ gcal_error: 'create: 500', gcal_event_id: null });
    const text = formatHealthReport(await runHealthCheck(NOW));
    expect(text).toContain('[긴급]');
    expect(text).toContain('이 메일은 이상이 있을 때만 발송됩니다.');
  });
});
