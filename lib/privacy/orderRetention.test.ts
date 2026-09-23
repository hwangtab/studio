/** @jest-environment node */

/**
 * 주문·구독 개인정보 파기를 실제 SQLite(in-memory)에서 검증한다.
 *
 * 계약서·펀딩 쪽 retention 테스트와 같은 이유로 실 DB를 쓴다 — NOT NULL 제약과 날짜 비교가
 * 실제로 어떻게 도는지는 모킹으로 알 수 없다.
 *
 * 핵심 불변식:
 * - 고객 이름·연락처는 법정 보존 5년이 지나기 전에는 파기하지 않는다.
 * - **살아 있는 구독(`ended`가 아닌 것)은 어떤 경우에도 파기하지 않는다.**
 * - 컬럼마다 기산점과 기간이 다르므로 서로의 시계를 건드리지 않는다.
 * - 파기는 행 삭제가 아니라 표식(NOT NULL) 또는 NULL이고, 다시 돌려도 중복되지 않는다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import {
  availabilityBlocks,
  billingKeys,
  bookings,
  orders,
  payments,
  refunds,
  subscriptions,
  workOrders,
} from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import {
  PURGED_MARK,
  purgeEndedSubscriptionDisplayNames,
  purgeExpiredAvailabilityBlockMemos,
  purgeExpiredBookingCustomerNotes,
  purgeExpiredOrderCustomerData,
  purgeExpiredPaymentFailMessages,
  purgeExpiredPaymentRawResponses,
  purgeExpiredRefundReasons,
  purgeExpiredSubscriptionCancelReasons,
  purgeExpiredSubscriptionCustomerData,
  purgeExpiredWorkOrderCustomerNotes,
  purgeUnusableBillingKeyRawResponses,
} from './orderRetention';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** 5년 boundary = 2021-08-24T18:00Z, 3년 = 2023-08-24T18:00Z, 1년 = 2025-08-24T18:00Z. */
const NOW = new Date('2026-08-24T18:00:00.000Z');

let seq = 0;

const addOrder = async (opts: {
  id?: string;
  type?: (typeof schema.orderTypeEnum)[number];
  customerName?: string;
  createdAt?: string;
  updatedAt?: string;
  paymentFailMessage?: string | null;
  paymentFailCode?: string | null;
  paymentFailedAt?: string | null;
  notificationError?: string | null;
}) => {
  seq += 1;
  const orderNo = `SNB-TEST-${String(seq).padStart(6, '0')}`;
  const [row] = await mockDb
    .insert(orders)
    .values({
      orderNo,
      type: opts.type ?? 'session',
      customerName: opts.customerName ?? '김고객',
      customerPhone: '010-1234-5678',
      customerEmail: 'a@example.com',
      itemAmount: 10000,
      vatAmount: 1000,
      totalAmount: 11000,
      status: 'paid',
      manageToken: `tok_${orderNo}`,
      notificationError: opts.notificationError ?? null,
      paymentFailCode: opts.paymentFailCode ?? null,
      paymentFailMessage: opts.paymentFailMessage ?? null,
      paymentFailedAt: opts.paymentFailedAt ? d(opts.paymentFailedAt) : null,
      createdAt: d(opts.createdAt ?? '2015-01-01'),
      updatedAt: d(opts.updatedAt ?? opts.createdAt ?? '2015-01-01'),
    })
    .returning({ id: orders.id });
  return row.id;
};

const orderOf = async (id: string) =>
  (await mockDb.select().from(orders).where(eq(orders.id, id)))[0];

const addSubscription = async (opts: {
  status?: (typeof schema.subscriptionStatusEnum)[number];
  kind?: (typeof schema.subscriptionKindEnum)[number];
  createdAt?: string;
  updatedAt?: string;
  endsAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  displayName?: string | null;
}) => {
  seq += 1;
  const [row] = await mockDb
    .insert(subscriptions)
    .values({
      kind: opts.kind ?? 'practice-room',
      customerName: '박구독',
      customerPhone: '010-2222-3333',
      customerEmail: 'sub@example.com',
      customerKey: `sub_key_${seq}`,
      itemAmount: 100000,
      vatAmount: 10000,
      totalAmount: 110000,
      billingDay: 5,
      status: opts.status ?? 'ended',
      manageToken: `sub_tok_${seq}`,
      displayName: opts.displayName ?? null,
      displayConsent: true,
      cancelledAt: opts.cancelledAt ? d(opts.cancelledAt) : null,
      cancelReason: opts.cancelReason ?? null,
      endsAt: opts.endsAt ? d(opts.endsAt) : null,
      createdAt: d(opts.createdAt ?? '2015-01-01'),
      updatedAt: d(opts.updatedAt ?? opts.createdAt ?? '2015-01-01'),
    })
    .returning({ id: subscriptions.id });
  return row.id;
};

const subOf = async (id: string) =>
  (await mockDb.select().from(subscriptions).where(eq(subscriptions.id, id)))[0];

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split(
      '--> statement-breakpoint',
    )) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

beforeEach(async () => {
  // 외래키 순서대로 — refunds → payments → bookings·work_orders → orders,
  // billing_keys → subscriptions.
  await client.execute('DELETE FROM refunds');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM bookings');
  await client.execute('DELETE FROM work_orders');
  await client.execute('DELETE FROM availability_blocks');
  await client.execute('DELETE FROM billing_keys');
  await client.execute('DELETE FROM subscriptions');
  await client.execute('DELETE FROM orders');
  seq = 0;
});

afterAll(() => client.close());

describe('주문 고객 정보 파기 (법정 보존 5년)', () => {
  it('5년이 안 지난 주문은 보관한다', async () => {
    const id = await addOrder({ createdAt: '2024-01-01' });
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(0);
    expect((await orderOf(id)).customerName).toBe('김고객');
  });

  it('5년이 지난 주문의 이름·연락처·이메일을 표식으로 덮는다', async () => {
    const id = await addOrder({ createdAt: '2015-01-01' });
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(1);
    const row = await orderOf(id);
    expect(row.customerName).toBe(PURGED_MARK);
    expect(row.customerPhone).toBe(PURGED_MARK);
    expect(row.customerEmail).toBe(PURGED_MARK);
  });

  it('생성은 5년 전이어도 최근에 환불돼 updated_at이 갱신된 주문은 보관한다', async () => {
    const id = await addOrder({ createdAt: '2015-01-01', updatedAt: '2025-06-01' });
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(0);
    expect((await orderOf(id)).customerName).toBe('김고객');
  });

  it('주문유형과 무관하게 같은 기준으로 판정한다', async () => {
    const ids = await Promise.all(
      (['session', 'mixing', 'subscription', 'funding'] as const).map((type) =>
        addOrder({ type, createdAt: '2015-01-01' }),
      ),
    );
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(4);
    for (const id of ids) expect((await orderOf(id)).customerName).toBe(PURGED_MARK);
  });

  it('행과 다른 컬럼은 그대로 남는다', async () => {
    const id = await addOrder({
      createdAt: '2015-01-01',
      paymentFailCode: 'REJECT_CARD_COMPANY',
      notificationError: 'customer:API_ERROR',
    });
    await purgeExpiredOrderCustomerData(NOW);
    const row = await orderOf(id);
    expect(row).toBeDefined();
    expect(row.totalAmount).toBe(11000);
    expect(row.status).toBe('paid');
    expect(row.manageToken).toBeTruthy();
    expect(row.paymentFailCode).toBe('REJECT_CARD_COMPANY');
    expect(row.notificationError).toBe('customer:API_ERROR');
  });

  it('멱등 — 이미 파기된 행은 다시 걸리지 않는다', async () => {
    await addOrder({ createdAt: '2015-01-01' });
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(1);
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(0);
  });
});

describe('결제 실패 사유 원문 파기 (1년)', () => {
  it('실패 후 1년이 안 지났으면 보관한다', async () => {
    const id = await addOrder({
      createdAt: '2026-01-01',
      paymentFailMessage: '카드 한도를 초과했습니다',
      paymentFailedAt: '2026-01-01',
    });
    expect((await purgeExpiredPaymentFailMessages(NOW)).purged).toBe(0);
    expect((await orderOf(id)).paymentFailMessage).toBe('카드 한도를 초과했습니다');
  });

  it('실패 후 1년이 지나면 파기하고 코드는 남긴다', async () => {
    const id = await addOrder({
      createdAt: '2024-01-01',
      paymentFailMessage: '카드 한도를 초과했습니다',
      paymentFailCode: 'EXCEED_MAX_AMOUNT',
      paymentFailedAt: '2024-01-01',
    });
    expect((await purgeExpiredPaymentFailMessages(NOW)).purged).toBe(1);
    const row = await orderOf(id);
    expect(row.paymentFailMessage).toBeNull();
    expect(row.paymentFailCode).toBe('EXCEED_MAX_AMOUNT');
  });

  it('실패 시각이 없으면 생성일로 센다', async () => {
    const id = await addOrder({ createdAt: '2024-01-01', paymentFailMessage: '알 수 없는 오류' });
    expect((await purgeExpiredPaymentFailMessages(NOW)).purged).toBe(1);
    expect((await orderOf(id)).paymentFailMessage).toBeNull();
  });

  it('고객 정보 파기의 기산점(updated_at)을 되감지 않는다', async () => {
    // 5년이 지난 주문인데 실패 사유만 먼저 파기된다. 여기서 updated_at을 지금으로
    // 갱신해 버리면 고객 정보 파기가 다시 5년 밀린다.
    const id = await addOrder({
      createdAt: '2015-01-01',
      paymentFailMessage: '카드 한도를 초과했습니다',
      paymentFailedAt: '2015-01-01',
    });
    await purgeExpiredPaymentFailMessages(NOW);
    expect((await orderOf(id)).updatedAt).toEqual(d('2015-01-01'));
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(1);
  });

  it('멱등 — 이미 NULL이면 다시 걸리지 않는다', async () => {
    await addOrder({ createdAt: '2024-01-01', paymentFailMessage: '실패' });
    expect((await purgeExpiredPaymentFailMessages(NOW)).purged).toBe(1);
    expect((await purgeExpiredPaymentFailMessages(NOW)).purged).toBe(0);
  });
});

describe('구독 고객 정보 파기 (종료 + 5년)', () => {
  it.each(['pending_card', 'active', 'past_due', 'paused', 'cancelled'] as const)(
    '살아 있는 구독(%s)은 아무리 오래돼도 파기하지 않는다',
    async (status) => {
      const id = await addSubscription({
        status,
        createdAt: '2010-01-01',
        endsAt: '2010-06-01',
        cancelledAt: '2010-05-01',
      });
      expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(0);
      expect((await subOf(id)).customerName).toBe('박구독');
    },
  );

  it('끝났어도 종료 후 5년이 안 지났으면 보관한다', async () => {
    const id = await addSubscription({ createdAt: '2015-01-01', endsAt: '2024-01-01' });
    expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(0);
    expect((await subOf(id)).customerName).toBe('박구독');
  });

  it('종료 후 5년이 지나면 표식으로 덮는다', async () => {
    const id = await addSubscription({ createdAt: '2015-01-01', endsAt: '2016-01-01' });
    expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(1);
    const row = await subOf(id);
    expect(row.customerName).toBe(PURGED_MARK);
    expect(row.customerPhone).toBe(PURGED_MARK);
    expect(row.customerEmail).toBe(PURGED_MARK);
    // 행과 결제 식별자는 그대로다.
    expect(row.customerKey).toBeTruthy();
    expect(row.totalAmount).toBe(110000);
  });

  it('종료일이 없으면 최종 갱신일로 센다', async () => {
    const id = await addSubscription({ createdAt: '2015-01-01', updatedAt: '2016-01-01', endsAt: null });
    expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(1);
    expect((await subOf(id)).customerName).toBe(PURGED_MARK);
  });

  it('생성된 지 5년이 안 됐으면 종료일이 과거로 잘못 적혀 있어도 보관한다', async () => {
    const id = await addSubscription({ createdAt: '2026-01-01', endsAt: '2016-01-01' });
    expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(0);
    expect((await subOf(id)).customerName).toBe('박구독');
  });

  it('멱등 — 이미 파기된 행은 다시 걸리지 않는다', async () => {
    await addSubscription({ createdAt: '2015-01-01', endsAt: '2016-01-01' });
    expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(1);
    expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(0);
  });
});

describe('후원자 표시 이름 파기 (종료 즉시)', () => {
  it('후원 중인 구독의 표시 이름은 지우지 않는다', async () => {
    const id = await addSubscription({
      kind: 'artist-support',
      status: 'cancelled',
      displayName: '응원하는 사람',
      createdAt: '2015-01-01',
    });
    expect((await purgeEndedSubscriptionDisplayNames()).purged).toBe(0);
    expect((await subOf(id)).displayName).toBe('응원하는 사람');
  });

  it('끝난 구독의 표시 이름은 기간을 기다리지 않고 파기한다', async () => {
    const id = await addSubscription({
      kind: 'artist-support',
      status: 'ended',
      displayName: '응원하는 사람',
      createdAt: '2026-01-01',
      endsAt: '2026-08-01',
    });
    expect((await purgeEndedSubscriptionDisplayNames()).purged).toBe(1);
    const row = await subOf(id);
    expect(row.displayName).toBeNull();
    // 동의 여부와 고객 정보는 각자의 기준을 따른다 — 여기서 건드리지 않는다.
    expect(row.displayConsent).toBe(true);
    expect(row.customerName).toBe('박구독');
  });

  it('멱등 — 이미 NULL이면 다시 걸리지 않는다', async () => {
    await addSubscription({ status: 'ended', displayName: '응원하는 사람' });
    expect((await purgeEndedSubscriptionDisplayNames()).purged).toBe(1);
    expect((await purgeEndedSubscriptionDisplayNames()).purged).toBe(0);
  });
});

describe('구독 해지 사유 파기 (해지 + 3년)', () => {
  it('해지 예약 상태(cancelled)에서는 지우지 않는다', async () => {
    const id = await addSubscription({
      status: 'cancelled',
      createdAt: '2010-01-01',
      cancelledAt: '2010-02-01',
      cancelReason: '이사 갑니다. 010-5555-6666으로 연락 주세요',
    });
    expect((await purgeExpiredSubscriptionCancelReasons(NOW)).purged).toBe(0);
    expect((await subOf(id)).cancelReason).toContain('이사');
  });

  it('해지 후 3년이 안 지났으면 보관한다', async () => {
    const id = await addSubscription({
      createdAt: '2015-01-01',
      cancelledAt: '2025-01-01',
      cancelReason: '가격이 부담됩니다',
    });
    expect((await purgeExpiredSubscriptionCancelReasons(NOW)).purged).toBe(0);
    expect((await subOf(id)).cancelReason).toBe('가격이 부담됩니다');
  });

  it('해지 후 3년이 지나면 파기한다', async () => {
    const id = await addSubscription({
      createdAt: '2015-01-01',
      cancelledAt: '2020-01-01',
      cancelReason: '가격이 부담됩니다',
    });
    expect((await purgeExpiredSubscriptionCancelReasons(NOW)).purged).toBe(1);
    const row = await subOf(id);
    expect(row.cancelReason).toBeNull();
    // 해지가 있었다는 사실과 시점은 남는다.
    expect(row.cancelledAt).toEqual(d('2020-01-01'));
    expect(row.status).toBe('ended');
  });

  it('고객 정보 5년보다 먼저 지워진다 — 기준이 다르다', async () => {
    const id = await addSubscription({
      createdAt: '2015-01-01',
      cancelledAt: '2022-06-01',
      endsAt: '2022-07-01',
      cancelReason: '가격이 부담됩니다',
    });
    expect((await purgeExpiredSubscriptionCancelReasons(NOW)).purged).toBe(1);
    expect((await purgeExpiredSubscriptionCustomerData(NOW)).purged).toBe(0);
    expect((await subOf(id)).customerName).toBe('박구독');
  });

  it('멱등 — 이미 NULL이면 다시 걸리지 않는다', async () => {
    await addSubscription({ createdAt: '2015-01-01', cancelledAt: '2020-01-01', cancelReason: '끝' });
    expect((await purgeExpiredSubscriptionCancelReasons(NOW)).purged).toBe(1);
    expect((await purgeExpiredSubscriptionCancelReasons(NOW)).purged).toBe(0);
  });
});

/** 아래부터는 자유기재 메모와 결제사 응답 원본의 파기(Task 2). */

const addPayment = async (opts: {
  orderId: string;
  approvedAt?: string | null;
  createdAt?: string;
  rawResponse?: string | null;
}) => {
  seq += 1;
  const [row] = await mockDb
    .insert(payments)
    .values({
      orderId: opts.orderId,
      paymentKey: `pay_key_${seq}`,
      method: '카드',
      approvedAt: opts.approvedAt ? d(opts.approvedAt) : null,
      receiptUrl: 'https://receipt.example/1',
      rawResponse: opts.rawResponse === undefined ? '{"paymentKey":"pay"}' : opts.rawResponse,
      createdAt: d(opts.createdAt ?? '2015-01-01'),
    })
    .returning({ id: payments.id });
  return row.id;
};

const paymentOf = async (id: string) =>
  (await mockDb.select().from(payments).where(eq(payments.id, id)))[0];

const addRefund = async (opts: { paymentId: string; reason?: string; createdAt?: string }) => {
  const [row] = await mockDb
    .insert(refunds)
    .values({
      paymentId: opts.paymentId,
      amount: 11000,
      reason: opts.reason ?? '고객 셀프 취소',
      requestedBy: 'customer',
      status: 'done',
      createdAt: d(opts.createdAt ?? '2015-01-01'),
    })
    .returning({ id: refunds.id });
  return row.id;
};

const refundOf = async (id: string) =>
  (await mockDb.select().from(refunds).where(eq(refunds.id, id)))[0];

const addBooking = async (opts: {
  orderId: string;
  startAt?: string;
  cancelledAt?: string | null;
  createdAt?: string;
  customerNote?: string | null;
}) => {
  const start = d(opts.startAt ?? '2015-01-02');
  const [row] = await mockDb
    .insert(bookings)
    .values({
      orderId: opts.orderId,
      productId: 'recording-basic',
      serviceType: 'recording',
      startAt: start,
      endAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      durationHours: 2,
      status: opts.cancelledAt ? 'cancelled' : 'completed',
      customerNote: opts.customerNote === undefined ? '무릎 수술 직후라 의자가 필요합니다' : opts.customerNote,
      cancelledAt: opts.cancelledAt ? d(opts.cancelledAt) : null,
      createdAt: d(opts.createdAt ?? '2015-01-01'),
      updatedAt: d(opts.createdAt ?? '2015-01-01'),
    })
    .returning({ id: bookings.id });
  return row.id;
};

const bookingOf = async (id: string) =>
  (await mockDb.select().from(bookings).where(eq(bookings.id, id)))[0];

const addWorkOrder = async (opts: {
  orderId: string;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  customerNote?: string | null;
}) => {
  const [row] = await mockDb
    .insert(workOrders)
    .values({
      orderId: opts.orderId,
      productId: 'mixing-level1',
      serviceType: 'mixing',
      songCount: 1,
      vocalTuning: false,
      status: opts.cancelledAt ? 'cancelled' : 'delivered',
      customerNote:
        opts.customerNote === undefined ? 'https://drive.example/개인폴더/vocal.wav' : opts.customerNote,
      deliveredAt: opts.deliveredAt ? d(opts.deliveredAt) : null,
      cancelledAt: opts.cancelledAt ? d(opts.cancelledAt) : null,
      createdAt: d(opts.createdAt ?? '2015-01-01'),
      updatedAt: d(opts.createdAt ?? '2015-01-01'),
    })
    .returning({ id: workOrders.id });
  return row.id;
};

const workOrderOf = async (id: string) =>
  (await mockDb.select().from(workOrders).where(eq(workOrders.id, id)))[0];

const addBlock = async (opts: { endAt: string; memo?: string | null }) => {
  const end = d(opts.endAt);
  const [row] = await mockDb
    .insert(availabilityBlocks)
    .values({
      startAt: new Date(end.getTime() - 2 * 60 * 60 * 1000),
      endAt: end,
      memo: opts.memo === undefined ? '이수진님 가녹음' : opts.memo,
    })
    .returning({ id: availabilityBlocks.id });
  return row.id;
};

const blockOf = async (id: string) =>
  (await mockDb.select().from(availabilityBlocks).where(eq(availabilityBlocks.id, id)))[0];

const addBillingKey = async (opts: {
  subscriptionId: string;
  revokedAt?: string | null;
  rawResponse?: string | null;
}) => {
  seq += 1;
  const [row] = await mockDb
    .insert(billingKeys)
    .values({
      subscriptionId: opts.subscriptionId,
      billingKey: `bkey_${seq}`,
      cardCompany: '신한',
      cardNumberMasked: '43301234****123*',
      cardType: '신용',
      issuedAt: d('2015-01-01'),
      revokedAt: opts.revokedAt ? d(opts.revokedAt) : null,
      rawResponse: opts.rawResponse === undefined ? '{"billingKey":"bkey"}' : opts.rawResponse,
      createdAt: d('2015-01-01'),
    })
    .returning({ id: billingKeys.id });
  return row.id;
};

const billingKeyOf = async (id: string) =>
  (await mockDb.select().from(billingKeys).where(eq(billingKeys.id, id)))[0];

describe('결제 승인 응답 원본 파기 (법정 보존 5년)', () => {
  it('승인 5년이 안 지났으면 보관한다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    const id = await addPayment({ orderId, approvedAt: '2024-01-01' });
    expect((await purgeExpiredPaymentRawResponses(NOW)).purged).toBe(0);
    expect((await paymentOf(id)).rawResponse).toBe('{"paymentKey":"pay"}');
  });

  it('승인 5년이 지나면 원본만 비운다 — 대사용 컬럼과 행은 남는다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    const id = await addPayment({ orderId, approvedAt: '2015-01-01' });
    expect((await purgeExpiredPaymentRawResponses(NOW)).purged).toBe(1);
    const row = await paymentOf(id);
    expect(row.rawResponse).toBeNull();
    expect(row.paymentKey).toBeTruthy();
    expect(row.method).toBe('카드');
    expect(row.receiptUrl).toBe('https://receipt.example/1');
    expect(row.approvedAt).not.toBeNull();
  });

  it('승인 시각이 없으면 행 생성일로 센다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    const recent = await addPayment({ orderId, approvedAt: null, createdAt: '2025-01-01' });
    const old = await addPayment({ orderId, approvedAt: null, createdAt: '2015-01-01' });
    expect((await purgeExpiredPaymentRawResponses(NOW)).purged).toBe(1);
    expect((await paymentOf(recent)).rawResponse).not.toBeNull();
    expect((await paymentOf(old)).rawResponse).toBeNull();
  });

  it('멱등 — 이미 비운 행은 다시 걸리지 않는다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    await addPayment({ orderId, approvedAt: '2015-01-01' });
    expect((await purgeExpiredPaymentRawResponses(NOW)).purged).toBe(1);
    expect((await purgeExpiredPaymentRawResponses(NOW)).purged).toBe(0);
  });
});

describe('빌링키 발급 응답 원본 파기', () => {
  it('살아 있는 구독의 유효한 키는 건드리지 않는다', async () => {
    const subId = await addSubscription({ status: 'active' });
    const id = await addBillingKey({ subscriptionId: subId });
    expect((await purgeUnusableBillingKeyRawResponses()).purged).toBe(0);
    expect((await billingKeyOf(id)).rawResponse).toBe('{"billingKey":"bkey"}');
  });

  it('폐기된 키의 원본을 비운다 — 카드 근거 컬럼은 남는다', async () => {
    const subId = await addSubscription({ status: 'active' });
    const id = await addBillingKey({ subscriptionId: subId, revokedAt: '2026-08-01' });
    expect((await purgeUnusableBillingKeyRawResponses()).purged).toBe(1);
    const row = await billingKeyOf(id);
    expect(row.rawResponse).toBeNull();
    expect(row.billingKey).toBeTruthy();
    expect(row.cardCompany).toBe('신한');
    expect(row.cardNumberMasked).toBe('43301234****123*');
    expect(row.revokedAt).not.toBeNull();
  });

  it('구독이 끝났으면 폐기 표시가 없어도 비운다 — 해지는 키를 폐기하지 않는다', async () => {
    const endedId = await addSubscription({ status: 'ended' });
    const liveId = await addSubscription({ status: 'active' });
    const ended = await addBillingKey({ subscriptionId: endedId });
    const live = await addBillingKey({ subscriptionId: liveId });
    expect((await purgeUnusableBillingKeyRawResponses()).purged).toBe(1);
    expect((await billingKeyOf(ended)).rawResponse).toBeNull();
    expect((await billingKeyOf(live)).rawResponse).not.toBeNull();
  });

  it('멱등 — 이미 비운 행은 다시 걸리지 않는다', async () => {
    const subId = await addSubscription({ status: 'ended' });
    await addBillingKey({ subscriptionId: subId });
    expect((await purgeUnusableBillingKeyRawResponses()).purged).toBe(1);
    expect((await purgeUnusableBillingKeyRawResponses()).purged).toBe(0);
  });
});

describe('환불 사유 파기 (법정 보존 5년)', () => {
  it('5년이 안 지난 환불 기록은 보관한다', async () => {
    const orderId = await addOrder({ createdAt: '2024-01-01' });
    const paymentId = await addPayment({ orderId, createdAt: '2024-01-01' });
    const id = await addRefund({ paymentId, reason: '김고객 요청 — 010-1234-5678', createdAt: '2024-02-01' });
    expect((await purgeExpiredRefundReasons(NOW)).purged).toBe(0);
    expect((await refundOf(id)).reason).toBe('김고객 요청 — 010-1234-5678');
  });

  it('5년이 지나면 표식으로 덮는다 — NOT NULL이라 비울 수 없다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    const paymentId = await addPayment({ orderId });
    const id = await addRefund({ paymentId, reason: '김고객 요청 — 010-1234-5678' });
    expect((await purgeExpiredRefundReasons(NOW)).purged).toBe(1);
    const row = await refundOf(id);
    expect(row.reason).toBe(PURGED_MARK);
    expect(row.amount).toBe(11000);
    expect(row.requestedBy).toBe('customer');
    expect(row.status).toBe('done');
  });

  it('멱등 — 표식이 든 행은 다시 걸리지 않는다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    const paymentId = await addPayment({ orderId });
    await addRefund({ paymentId });
    expect((await purgeExpiredRefundReasons(NOW)).purged).toBe(1);
    expect((await purgeExpiredRefundReasons(NOW)).purged).toBe(0);
  });
});

describe('예약 요청사항 파기 (3년)', () => {
  it('이용 3년이 안 지났으면 보관한다', async () => {
    const orderId = await addOrder({ createdAt: '2024-01-01' });
    const id = await addBooking({ orderId, startAt: '2024-03-01', createdAt: '2024-01-01' });
    expect((await purgeExpiredBookingCustomerNotes(NOW)).purged).toBe(0);
    expect((await bookingOf(id)).customerNote).not.toBeNull();
  });

  it('이용 3년이 지나면 비운다 — 예약 자체는 그대로다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    const id = await addBooking({ orderId, startAt: '2015-01-02' });
    expect((await purgeExpiredBookingCustomerNotes(NOW)).purged).toBe(1);
    const row = await bookingOf(id);
    expect(row.customerNote).toBeNull();
    expect(row.productId).toBe('recording-basic');
    expect(row.status).toBe('completed');
    expect(row.startAt).not.toBeNull();
  });

  it('취소된 예약은 취소 시각으로 센다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    const id = await addBooking({ orderId, startAt: '2015-01-02', cancelledAt: '2025-01-01' });
    expect((await purgeExpiredBookingCustomerNotes(NOW)).purged).toBe(0);
    expect((await bookingOf(id)).customerNote).not.toBeNull();
  });

  it('날짜를 잘못 잡아 이용일이 과거인 새 예약은 지우지 않는다', async () => {
    const orderId = await addOrder({ createdAt: '2026-08-01' });
    const id = await addBooking({ orderId, startAt: '2015-01-02', createdAt: '2026-08-01' });
    expect((await purgeExpiredBookingCustomerNotes(NOW)).purged).toBe(0);
    expect((await bookingOf(id)).customerNote).not.toBeNull();
  });

  it('고객 정보 5년보다 먼저 지워진다 — 기준이 다르다', async () => {
    const orderId = await addOrder({ createdAt: '2022-01-01', updatedAt: '2022-01-01' });
    await addBooking({ orderId, startAt: '2022-02-01', createdAt: '2022-01-01' });
    expect((await purgeExpiredBookingCustomerNotes(NOW)).purged).toBe(1);
    expect((await purgeExpiredOrderCustomerData(NOW)).purged).toBe(0);
    expect((await orderOf(orderId)).customerName).toBe('김고객');
  });

  it('멱등 — 이미 NULL이면 다시 걸리지 않는다', async () => {
    const orderId = await addOrder({ createdAt: '2015-01-01' });
    await addBooking({ orderId });
    expect((await purgeExpiredBookingCustomerNotes(NOW)).purged).toBe(1);
    expect((await purgeExpiredBookingCustomerNotes(NOW)).purged).toBe(0);
  });
});

describe('믹싱 주문 요청사항 파기 (3년)', () => {
  it('납품 3년이 안 지났으면 보관한다', async () => {
    const orderId = await addOrder({ type: 'mixing', createdAt: '2024-01-01' });
    const id = await addWorkOrder({ orderId, deliveredAt: '2024-03-01', createdAt: '2024-01-01' });
    expect((await purgeExpiredWorkOrderCustomerNotes(NOW)).purged).toBe(0);
    expect((await workOrderOf(id)).customerNote).not.toBeNull();
  });

  it('납품 3년이 지나면 파일 링크를 비운다', async () => {
    const orderId = await addOrder({ type: 'mixing', createdAt: '2015-01-01' });
    const id = await addWorkOrder({ orderId, deliveredAt: '2015-02-01' });
    expect((await purgeExpiredWorkOrderCustomerNotes(NOW)).purged).toBe(1);
    const row = await workOrderOf(id);
    expect(row.customerNote).toBeNull();
    expect(row.songCount).toBe(1);
    expect(row.status).toBe('delivered');
  });

  it('납품도 취소도 없으면 생성일로 센다', async () => {
    const orderId = await addOrder({ type: 'mixing', createdAt: '2024-06-01' });
    const id = await addWorkOrder({
      orderId,
      deliveredAt: null,
      cancelledAt: null,
      createdAt: '2024-06-01',
    });
    expect((await purgeExpiredWorkOrderCustomerNotes(NOW)).purged).toBe(0);
    expect((await workOrderOf(id)).customerNote).not.toBeNull();
  });

  it('취소된 주문은 취소 시각으로 센다', async () => {
    const orderId = await addOrder({ type: 'mixing', createdAt: '2015-01-01' });
    const id = await addWorkOrder({ orderId, deliveredAt: null, cancelledAt: '2025-06-01' });
    expect((await purgeExpiredWorkOrderCustomerNotes(NOW)).purged).toBe(0);
    expect((await workOrderOf(id)).customerNote).not.toBeNull();
  });

  it('멱등 — 이미 NULL이면 다시 걸리지 않는다', async () => {
    const orderId = await addOrder({ type: 'mixing', createdAt: '2015-01-01' });
    await addWorkOrder({ orderId, deliveredAt: '2015-02-01' });
    expect((await purgeExpiredWorkOrderCustomerNotes(NOW)).purged).toBe(1);
    expect((await purgeExpiredWorkOrderCustomerNotes(NOW)).purged).toBe(0);
  });
});

describe('일정 차단 메모 파기 (1년)', () => {
  it('1년이 안 지난 일정의 메모는 보관한다', async () => {
    const id = await addBlock({ endAt: '2026-06-01' });
    expect((await purgeExpiredAvailabilityBlockMemos(NOW)).purged).toBe(0);
    expect((await blockOf(id)).memo).toBe('이수진님 가녹음');
  });

  it('1년이 지나면 메모만 비운다 — 시간대는 남는다', async () => {
    const id = await addBlock({ endAt: '2024-06-01' });
    expect((await purgeExpiredAvailabilityBlockMemos(NOW)).purged).toBe(1);
    const row = await blockOf(id);
    expect(row.memo).toBeNull();
    expect(row.startAt).not.toBeNull();
    expect(row.endAt).not.toBeNull();
  });

  it('멱등 — 메모가 없던 행도 다시 걸리지 않는다', async () => {
    await addBlock({ endAt: '2024-06-01' });
    await addBlock({ endAt: '2024-06-02', memo: null });
    expect((await purgeExpiredAvailabilityBlockMemos(NOW)).purged).toBe(1);
    expect((await purgeExpiredAvailabilityBlockMemos(NOW)).purged).toBe(0);
  });
});
