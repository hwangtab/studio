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
jest.mock('../booking/gcal', () => ({
  ...jest.requireActual('../booking/gcal'),
  fetchBusyRanges: jest.fn(),
}));
// 이 파일은 마이그레이션 드리프트가 아니라 나머지 점검을 검증한다. 별도로 목킹하지
// 않으면 in-memory DB에 __drizzle_migrations 테이블이 없어 "판정 불가"가 아니라
// "0개 적용"으로 읽혀 로컬 .env.local의 TURSO 값 유무에 따라 이 파일의 건수 assertion이
// 흔들린다(migrationDrift 자체의 동작은 migrationDrift.test.ts가 별도로 검증한다).
jest.mock('./migrationDrift', () => ({
  checkMigrationDrift: jest.fn().mockResolvedValue({ status: 'unknown', localCount: 0, appliedCount: null, pendingCount: 0, pendingTags: [] }),
}));

// eslint-disable-next-line import/first
import { fetchBusyRanges } from '../booking/gcal';
// eslint-disable-next-line import/first
import { checkFieldCryptoKey, formatHealthReport, runHealthCheck } from './healthCheck';
// eslint-disable-next-line import/first
import { FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';

/**
 * 필드 암호화 키 점검이 이 파일의 다른 건수 assertion을 흔들지 않게 기본값을 깔아 둔다.
 * (이 테스트 전용 값이고 운영 키와 무관하다 — 32바이트 0을 base64로 적은 것이다.)
 * 키가 없는 경우는 아래 전용 describe가 env를 지웠다 되돌리며 따로 본다.
 */
const TEST_FIELD_KEY = Buffer.alloc(32).toString('base64');
process.env[FIELD_CRYPTO_KEY_ENV] = TEST_FIELD_KEY;

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
  // refunds가 payments를, subscription_payments가 orders·subscriptions를 참조하므로
  // 참조하는 쪽을 먼저 지운다. refunds가 빠져 있어 테스트끼리 오염된 적이 있다.
  for (const table of ['refunds', 'payments', 'bookings', 'funding_pledges', 'subscription_payments', 'subscriptions', 'orders', 'contracts']) {
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
    expect(issues[0].title).toContain('녹음실 예약 캘린더');
    expect(issues[0].detail).toContain('invalid_grant');
  });

  it('연습실 캘린더가 설정돼 있으면 그것도 같은 기준으로 점검한다', async () => {
    process.env.PRACTICE_ROOM_GCAL_ID = 'rooms-cal';
    try {
      (fetchBusyRanges as jest.Mock).mockImplementation(async (_a: Date, _b: Date, which?: string) => {
        if (which === 'practice-room') throw new Error('notFound');
        return [];
      });
      const issues = (await runHealthCheck(NOW)).issues;
      const rooms = issues.find((i) => i.title.includes('연습실 예약 캘린더'));
      expect(rooms?.severity).toBe('high');
      expect(rooms?.detail).toContain('PRACTICE_ROOM_GCAL_ID');
      expect(issues.some((i) => i.title.includes('녹음실 예약 캘린더'))).toBe(false);
    } finally {
      delete process.env.PRACTICE_ROOM_GCAL_ID;
    }
  });

  it('연습실 캘린더 env가 없으면 연습실은 점검하지 않는다', async () => {
    delete process.env.PRACTICE_ROOM_GCAL_ID;
    (fetchBusyRanges as jest.Mock).mockResolvedValue([]);
    await runHealthCheck(NOW);
    const calls = (fetchBusyRanges as jest.Mock).mock.calls.map((c) => c[2]);
    expect(calls).toEqual(['studio']);
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

  it('확인 메일이 실패한 주문을 주문번호와 함께 보고한다', async () => {
    await insertOrder({ notification_error: 'customer:TIMEOUT' });
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].title).toContain('확인 메일이 나가지 않은 주문 1건');
    expect(issues[0].detail).toContain('발송 실패: 1건');
    expect(issues[0].detail).toContain('SNB-1');
  });

  /**
   * 센티널(`send_pending`·`send_inflight`)은 실패가 아니라 "아직 안 나갔다"다. 셋을
   * 뭉뚱그려 "발송 실패"로 보고하면 웹훅이 곧 처리할 건까지 사고로 읽혀 헛걸음을 만든다.
   */
  it('센티널로 멈춘 건은 발송 실패와 갈라 센다', async () => {
    await insertOrder({ id: 'o1', order_no: 'SNB-1', manage_token: 't1', notification_error: 'customer:TIMEOUT' });
    await insertOrder({ id: 'o2', order_no: 'SNB-2', manage_token: 't2', notification_error: 'send_inflight' });
    await insertOrder({ id: 'o3', order_no: 'SNB-3', manage_token: 't3', notification_error: 'send_pending' });

    const issue = (await runHealthCheck(NOW)).issues.find((i) =>
      i.title.includes('확인 메일이 나가지 않은 주문'),
    )!;
    expect(issue.title).toContain('3건');
    expect(issue.detail).toContain('발송 실패: 1건');
    expect(issue.detail).toContain('멈춤: 2건');
    // 운영자에게 내부 예약어를 보여주지 않는다.
    expect(issue.detail).not.toContain('send_inflight');
    expect(issue.detail).not.toContain('send_pending');
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

  /**
   * 환불 기록은 결제액에 닿았는데 주문은 아직 살아 있는 상태. 셀프 취소의 선점 되돌림과
   * 웹훅 대사가 엇갈리거나, 토스 콘솔에서 손으로 취소하면 생긴다. 어긋난 채 두면 공개
   * 모금액에 환불된 돈이 남고 그 후원자가 음원을 계속 받는데, 관리자 목록의 불일치 배지는
   * 이걸 못 본다(허용 목록에 paid가 있다).
   */
  const insertDoneRefund = async (amount: number, id = 'rf1', paymentId = 'p1', orderId = 'o1') => {
    await client.execute({ sql: "INSERT INTO payments (id, order_id, payment_key) VALUES (?, ?, ?)", args: [paymentId, orderId, `pk_${paymentId}`] });
    await client.execute({
      sql: "INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES (?, ?, ?, '취소', 'customer', 'done')",
      args: [id, paymentId, amount],
    });
  };

  it('전액 환불됐는데 주문이 살아 있으면 긴급으로 보고한다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'paid', total_amount: 30000 });
    await insertFundingPledge();
    await insertDoneRefund(30000);
    const issues = (await runHealthCheck(NOW)).issues;
    expect(issues[0].severity).toBe('high');
    expect(issues[0].title).toContain('전액 환불됐는데 주문이 살아 있는 펀딩 1건');
    expect(issues[0].detail).toContain('FND-1');
  });

  it('잔액이 남은 부분환불은 정상이다 — 리워드 의무가 남아 있는 상태다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'partially_refunded', total_amount: 30000 });
    await insertFundingPledge();
    await insertDoneRefund(10000);
    expect(await titles()).toEqual([]);
  });

  it('상태가 이미 refunded면 보고하지 않는다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'refunded', total_amount: 30000 });
    await insertFundingPledge();
    await insertDoneRefund(30000);
    expect(await titles()).toEqual([]);
  });

  it('실패한 환불 기록은 세지 않는다 — 돈이 나가지 않았다', async () => {
    await insertOrder({ order_no: 'FND-1', status: 'paid', total_amount: 30000 });
    await insertFundingPledge();
    await client.execute("INSERT INTO payments (id, order_id, payment_key) VALUES ('p1','o1','pk_p1')");
    await client.execute("INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES ('rf1','p1',30000,'취소','customer','failed')");
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

  /**
   * 키가 빠진 배포는 DB에 흔적을 남기지 않는다 — 개설자가 "저장이 안 된다"고 연락해 줄
   * 때까지 아무도 모르는 것이 이 점검을 넣은 이유다. 값이 메일에 새지 않는 것도 함께 본다.
   */
  describe('필드 암호화 키 점검', () => {
    afterEach(() => { process.env[FIELD_CRYPTO_KEY_ENV] = TEST_FIELD_KEY; });

    it('키가 쓸 수 있으면 아무것도 보고하지 않는다', () => {
      expect(checkFieldCryptoKey()).toBeNull();
    });

    it('키가 없으면 긴급으로 보고한다', () => {
      delete process.env[FIELD_CRYPTO_KEY_ENV];
      const issue = checkFieldCryptoKey()!;
      expect(issue.severity).toBe('high');
      expect(issue.title).toContain('없음');
      expect(issue.detail).toContain(FIELD_CRYPTO_KEY_ENV);
    });

    it('길이가 32바이트가 아니면 형식 이상으로 보고한다', () => {
      process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(16).toString('base64');
      const issue = checkFieldCryptoKey()!;
      expect(issue.severity).toBe('high');
      expect(issue.title).toContain('형식 이상');
    });

    it('키 값도 암호문도 메일 본문에 실리지 않는다', async () => {
      const secret = Buffer.alloc(31, 7).toString('base64'); // 잘못된 길이 → 형식 이상
      process.env[FIELD_CRYPTO_KEY_ENV] = secret;
      await insertOrder();
      await insertBooking();
      const text = formatHealthReport(await runHealthCheck(NOW));
      expect(text).toContain(FIELD_CRYPTO_KEY_ENV);
      expect(text).not.toContain(secret);
    });

    it('크론 보고에 섞여 나온다', async () => {
      delete process.env[FIELD_CRYPTO_KEY_ENV];
      await insertOrder();
      await insertBooking();
      expect((await titles()).join()).toContain('필드 암호화 키');
    });
  });

  it('메일 본문에 무엇을 해야 하는지가 들어간다', async () => {
    await insertOrder();
    await insertBooking({ gcal_error: 'create: 500', gcal_event_id: null });
    const text = formatHealthReport(await runHealthCheck(NOW));
    expect(text).toContain('[긴급]');
    expect(text).toContain('이 메일은 이상이 있을 때만 발송됩니다.');
  });
});

/**
 * 해지·종료된 구독에 돈이 들어온 건 — 고객은 한 달치를 냈는데 이용기간은 전진하지 않았다.
 * 승인 시점에 운영자 메일이 한 통 나가지만(alertLateApproval) 메일은 실패하거나 묻힐 수
 * 있어, 두 번째 겹으로 여기서도 센다. 환불하면 자동으로 사라져야 한다(영구 알람 금지).
 */
describe('구독이 끝난 뒤에 들어온 결제', () => {
  /**
   * 종료 시각과 결제 시각을 따로 받는다 — 이 점검의 판정이 "상태"가 아니라 "순서"이기
   * 때문이다. 기본값은 사고 형태 그대로다: 해지한 뒤에 결제가 반영된 건.
   */
  const seed = async (
    subStatus: string,
    orderStatus = 'paid',
    times: {
      cancelledAt?: string | null;
      endsAt?: string | null;
      paidAt?: string | null;
      /** 마지막 활동 시각. 방치 종료 구독에서는 이 값이 곧 "끝난 시각"이다. */
      updatedAt?: string;
    } = {},
  ) => {
    const cancelledAt = times.cancelledAt === undefined ? '2026-09-05T00:00:00Z' : times.cancelledAt;
    const endsAt = times.endsAt === undefined ? '2026-09-05T00:00:00Z' : times.endsAt;
    const paidAt = times.paidAt === undefined ? '2026-09-06T00:00:00Z' : times.paidAt;
    const updatedAt = times.updatedAt ?? '2026-09-05T00:00:00Z';
    await client.execute({
      sql: `INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email,
              customer_key, manage_token, item_amount, vat_amount, total_amount, billing_day, status,
              cancelled_at, ends_at, created_at, updated_at)
            VALUES ('s1','lesson','김수강','010-1','a@b.c','sub_k','mtok',360000,36000,396000,5,?,?,?,unixepoch(),?)`,
      args: [
        subStatus,
        cancelledAt ? EPOCH(cancelledAt) : null,
        endsAt ? EPOCH(endsAt) : null,
        EPOCH(updatedAt),
      ],
    });
    await insertOrder({ id: 'o9', order_no: 'SUB-1', manage_token: 't9', status: orderStatus });
    await client.execute({
      sql: `INSERT INTO subscription_payments (id, subscription_id, order_id, cycle_ym, attempt, amount, status, attempted_at, paid_at)
            VALUES ('sp1','s1','o9','2026-09',1,396000,'paid',?,?)`,
      args: [EPOCH('2026-09-04T00:00:00Z'), paidAt ? EPOCH(paidAt) : null],
    });
  };

  const flagged = async () =>
    (await runHealthCheck(NOW)).issues.some((i) => i.title.includes('환불 판단 필요'));

  it('해지한 뒤에 들어온 결제는 환불 판단 필요로 보고한다', async () => {
    await seed('cancelled');
    const issue = (await runHealthCheck(NOW)).issues.find((i) => i.title.includes('환불 판단 필요'))!;
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('high');
    expect(issue.detail).toContain('SUB-1');
  });

  it('종료된 구독도 같이 센다', async () => {
    await seed('ended');
    expect(await flagged()).toBe(true);
  });

  /**
   * 이 점검의 회귀 지점. 조건이 상태만 볼 때는 정상적으로 끝난 구독이 과거의 성공 회차
   * 때문에 매일 다시 잡혔다 — 환불할 것이 없는데 꺼지지 않는 경보였다.
   */
  it('종료 전에 정상 청구된 회차만 있으면 세지 않는다', async () => {
    await seed('ended', 'paid', {
      cancelledAt: '2026-09-05T00:00:00Z',
      endsAt: '2026-09-05T00:00:00Z',
      paidAt: '2026-09-01T00:00:00Z',
    });
    expect(await flagged()).toBe(false);
  });

  /**
   * 방치로 종료된 구독(closeDormantSubscriptions)은 cancelled_at·ends_at을 채우지 않는다.
   * 예전에는 `coalesce(cancelled_at, ends_at)`가 NULL이 되어 비교식 전체가 NULL이 되고,
   * 이 픽스처가 그 동작을 "세지 않는다"로 고정하고 있었다 — 그런데 이 픽스처가 곧 사고
   * 형태다. 뒤늦은 승인에서 `paid_at`은 **지금**이라 "결제가 3년 넘게 전"이 성립하지 않는다.
   * 지금은 `updated_at`이 셋째 폴백으로 들어와 마지막 활동 뒤에 들어온 돈을 잡는다.
   */
  it('방치로 종료된 구독(종료 시각 없음)도 마지막 활동 뒤에 들어온 결제면 센다', async () => {
    await seed('ended', 'paid', { cancelledAt: null, endsAt: null });
    expect(await flagged()).toBe(true);
  });

  /** 마지막 활동보다 앞선 결제는 세지 않는다 — 폴백이 오탐을 만들지 않는지 확인한다. */
  it('방치로 종료된 구독이라도 마지막 활동 전의 결제는 세지 않는다', async () => {
    await seed('ended', 'paid', {
      cancelledAt: null,
      endsAt: null,
      updatedAt: '2026-09-07T00:00:00Z',
      paidAt: '2026-09-06T00:00:00Z',
    });
    expect(await flagged()).toBe(false);
  });

  /** cancelled_at이 비어도 ends_at이 있으면 그것을 기준으로 본다. */
  it('cancelled_at이 없으면 ends_at을 기준으로 본다', async () => {
    await seed('ended', 'paid', { cancelledAt: null, endsAt: '2026-09-05T00:00:00Z' });
    expect(await flagged()).toBe(true);
  });

  it('환불하면 사라진다', async () => {
    await seed('cancelled', 'refunded');
    expect(await flagged()).toBe(false);
  });

  it('부분 환불로는 꺼지지 않는다 — 잔액이 남아 있는 한 고객 돈은 아직 우리에게 있다', async () => {
    await seed('cancelled', 'partially_refunded');
    expect(await flagged()).toBe(true);
  });

  it('살아 있는 구독은 세지 않는다', async () => {
    await seed('active', 'paid', { cancelledAt: null, endsAt: null });
    expect(await flagged()).toBe(false);
  });
});

/**
 * 운영자가 세워 둔 구독이 곧 방치로 자동 종료되는 것 — 되돌릴 수 없는 유일한 전이라
 * 경보가 유일한 방어다. 경보가 조용히 고장 나면 살아 있는 구독이 말없이 닫힌다.
 *
 * NOW는 2026-09-10이고 방치는 3년, 경보는 30일 앞서므로 기준선은 2023-10-10이다.
 */
describe('곧 자동 종료되는 정지 구독', () => {
  const seedPaused = async (over: { pausedReason?: string | null; updatedAt?: string; status?: string } = {}) => {
    const updatedAt = over.updatedAt ?? '2023-09-01T00:00:00Z';
    await client.execute({
      sql: `INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email,
              customer_key, manage_token, item_amount, vat_amount, total_amount, billing_day,
              status, paused_reason, created_at, updated_at)
            VALUES ('sp-1','practice-room','박구독','010-2','p@q.r','sub_p','ptok',300000,30000,330000,1,?,?,?,?)`,
      args: [
        over.status ?? 'paused',
        over.pausedReason === undefined ? 'operator' : over.pausedReason,
        EPOCH(updatedAt),
        EPOCH(updatedAt),
      ],
    });
  };

  const issue = async () =>
    (await runHealthCheck(NOW)).issues.find((i) => i.title.includes('곧 자동 종료되는 정지 구독'));

  it('운영자 정지가 기준선을 넘으면 보고한다', async () => {
    await seedPaused();
    const found = await issue();
    expect(found).toBeDefined();
    expect(found!.severity).toBe('high');
    expect(found!.detail).toContain('sp-1');
  });

  /** 30일보다 더 남았으면 아직 조용하다 — 늘 떠 있는 항목은 읽히지 않는다. */
  it('경보 시점 전에는 뜨지 않는다', async () => {
    await seedPaused({ updatedAt: '2023-10-11T00:00:00Z' });
    expect(await issue()).toBeUndefined();
  });

  it('경보 시점을 하루 넘기면 뜬다 — 기준선이 실제로 30일이다', async () => {
    await seedPaused({ updatedAt: '2023-10-09T00:00:00Z' });
    expect(await issue()).toBeDefined();
  });

  /** 결제 실패로 세워진 정지가 닫히는 것은 설계대로다 — 알릴 일이 아니다. */
  it('결제 실패로 세워진 정지는 보고하지 않는다', async () => {
    await seedPaused({ pausedReason: 'payment_failed' });
    expect(await issue()).toBeUndefined();
  });

  /**
   * 컬럼 도입 전에 정지된 행. 어느 쪽이었는지 알 수 없고, 놓쳤을 때의 대가가 한쪽으로만
   * 크므로 함께 알린다.
   */
  it('사유가 기록되지 않은 정지도 함께 보고하고, 그 사실을 본문에 적는다', async () => {
    await seedPaused({ pausedReason: null });
    const found = await issue();
    expect(found).toBeDefined();
    expect(found!.detail).toContain('정지 사유가 기록되기 전에');
  });

  it('정지가 아닌 구독은 보고하지 않는다', async () => {
    await seedPaused({ status: 'active', pausedReason: null });
    expect(await issue()).toBeUndefined();
  });

  /**
   * **닫힌 뒤에는 경보가 멈춰야 한다.** 방치 종료는 사유를 지우지 않으므로
   * (`ended` + `operator`가 그대로 남는다) 상태를 안 보면 끌 수 없는 경보가 매일 뜬다.
   * 운영자가 할 수 있는 일이 없는데 꺼지지 않는 항목은 메일 전체를 안 읽게 만든다.
   */
  it('이미 종료된 구독은 사유가 남아 있어도 보고하지 않는다', async () => {
    await seedPaused({ status: 'ended', pausedReason: 'operator' });
    expect(await issue()).toBeUndefined();
  });
});

/**
 * 자동 재개 안내가 나가지 못하면 그 구독은 예고 없이 청구된다 — 발송은 매일 재시도되므로
 * 하루 이틀 밀린 것은 알리지 않고, **예고가 실제로 깨지는 시점**부터 올린다.
 */
describe('자동 재개 안내가 나가지 못한 구독', () => {
  /**
   * 두 크론의 실제 시각을 그대로 쓴다 — 이 경보가 한 번 놓쳤던 것이 **한 시간 차이**였다.
   * 청구(재개·안내 발송)는 09:00 KST, 이 점검은 08:00 KST에 돈다(`vercel.json`).
   */
  const CHARGE_CRON = (day: string) => new Date(`${day}T00:00:00Z`); // 09:00 KST
  const HEALTH_CRON = (day: string) => new Date(`${day}T23:00:00Z`); // 다음 날 08:00 KST

  /** 정지 기한이 끝나 D+0 09:00에 재개됐고, 최소 예고 바닥이라 첫 청구가 D+3 09:00인 구독. */
  const seedFloorCase = async (status = 'active') => {
    await client.execute({
      sql: `INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email,
              customer_key, manage_token, item_amount, vat_amount, total_amount, billing_day,
              status, next_billing_at, resume_notice_pending_at, created_at, updated_at)
            VALUES ('rn-1','lesson','최재개','010-3','r@q.r','sub_r','rtok',300000,30000,330000,5,?,?,?,?,?)`,
      args: [
        status,
        EPOCH('2026-09-04T00:00:00Z'), // 첫 청구 D+3 09:00 KST
        EPOCH('2026-09-01T00:00:00Z'), // 재개 D+0 09:00 KST
        EPOCH('2026-09-01T00:00:00Z'),
        EPOCH('2026-09-01T00:00:00Z'),
      ],
    });
  };

  const issueAt = async (at: Date) =>
    (await runHealthCheck(at)).issues.find((i) => i.title.includes('자동 재개 안내가 나가지 못한'));

  /**
   * **이 경보를 만든 이유가 이 경우다.** 기준을 `MIN_RESUME_NOTICE_DAYS`(3일)로 잡았을 때는
   * D+3 08:00 점검에서 표시(D+0 09:00)가 기준선(D+0 08:00)보다 한 시간 뒤라 걸리지 않았고,
   * 한 시간 뒤 09:00 청구가 그대로 긁었다.
   */
  it('최소 예고 바닥 구독도 첫 청구 전에 뜬다 — D+2 08:00, 청구는 D+3 09:00', async () => {
    await seedFloorCase();
    const found = await issueAt(HEALTH_CRON('2026-09-02')); // D+2 08:00 KST
    expect(found).toBeDefined();
    expect(found!.severity).toBe('high');
    expect(found!.detail).toContain('rn-1');
    // 경보가 뜬 시각이 청구(D+3 09:00)보다 앞이다.
    expect(HEALTH_CRON('2026-09-02').getTime()).toBeLessThan(CHARGE_CRON('2026-09-04').getTime());
  });

  it('D+3 08:00에도 여전히 떠 있다 — 청구 한 시간 전까지 꺼지지 않는다', async () => {
    await seedFloorCase();
    expect(await issueAt(HEALTH_CRON('2026-09-03'))).toBeDefined();
  });

  it('재개 당일 저녁(D+1 08:00)에는 아직 뜨지 않는다 — 그날 아침 재시도가 남아 있다', async () => {
    await seedFloorCase();
    expect(await issueAt(HEALTH_CRON('2026-09-01'))).toBeUndefined();
  });

  it('다시 정지·해지된 구독은 보고하지 않는다 — 청구가 오지 않는다', async () => {
    await seedFloorCase('paused');
    expect(await issueAt(HEALTH_CRON('2026-09-03'))).toBeUndefined();
  });
});
