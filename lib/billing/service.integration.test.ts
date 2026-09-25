/** @jest-environment node */

/**
 * 구독 수명주기를 실제 SQLite(in-memory)에 대고 돌린다.
 *
 * 상태 기계·재시도 카운트·멱등키는 SQL 문장 여러 개가 순서대로 맞물려야 드러나는 성질이라
 * 모킹으로는 잘 안 보인다(lib/booking/service.integration.test.ts와 같은 방식). 토스만
 * 모킹하고 DB는 진짜를 쓴다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { fixedSubscriptionAmounts } from './amounts';

const LESSON_TOTAL = fixedSubscriptionAmounts('lesson').totalAmount;

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/**
 * 운영자 알림은 메일 채널이라 실제로 나가면 안 된다 — 호출 여부만 본다.
 * (해지 구독에 뒤늦은 승인이 도착하면 사람에게 닿아야 한다는 규칙의 회귀 테스트용.)
 */
const sendSubscriptionOperatorAlert = jest.fn().mockResolvedValue(null);
jest.mock('./email', () => ({
  sendSubscriptionOperatorAlert: (...args: unknown[]) => sendSubscriptionOperatorAlert(...args),
}));

const issueBillingKey = jest.fn();
const chargeBillingKey = jest.fn();
const fetchPaymentByOrderId = jest.fn();
jest.mock('./toss-billing', () => ({
  issueBillingKey: (...args: unknown[]) => issueBillingKey(...args),
  chargeBillingKey: (...args: unknown[]) => chargeBillingKey(...args),
  fetchPaymentByOrderId: (...args: unknown[]) => fetchPaymentByOrderId(...args),
}));

// eslint-disable-next-line import/first
import {
  cancelSubscription,
  chargeCycle,
  chargeIdempotencyKey,
  claimDueSubscription,
  completeCardSetup,
  createSubscription,
  endExpiredSubscriptions,
  findSubscriptionById,
  findSubscriptionForManage,
  findSubscriptionForSetup,
  getSubscriptionWithDetails,
  issueCardChangeToken,
  listDueSubscriptions,
  clearResumeNotice,
  listPendingResumeNotices,
  MAX_PAUSE_DAYS,
  MIN_RESUME_NOTICE_DAYS,
  pauseSubscription,
  reconcileSubscriptionPaymentFromToss,
  resumeExpiredPauses,
  resumeSubscription,
} from './service';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-03-05T00:00:00Z');
/** 운영자 정지는 기한이 필수다 — 그 기한이 이 테스트들의 관심사가 아닐 때 쓰는 먼 날짜. */
const PAUSE_UNTIL = { pausedUntil: new Date('2026-12-01T00:00:00Z') };
/** 정지 전 예약일(4/5)을 확실히 지나친 만료일 — "예약일이 이미 지났다" 분기를 밟는다. */
const UNTIL_FAR = new Date('2026-07-01T00:00:00Z');

let client: Client;

const issuedOk = (billingKey = 'bkey_1') => ({
  ok: true as const,
  billingKey,
  card: { company: '신한', numberMasked: '433012******1234', cardType: '신용' },
  raw: { billingKey },
});
const chargeOk = (paymentKey = 'pay_1') => ({
  ok: true as const,
  payment: { paymentKey, orderId: 'x', status: 'DONE', totalAmount: 396000, approvedAt: '2026-03-05T09:00:00+09:00' },
});
const chargeFail = (code = 'REJECT_CARD_COMPANY') => ({ ok: false as const, code, message: '카드사 거절' });

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
  await client.execute('DELETE FROM subscription_payments');
  await client.execute('DELETE FROM billing_keys');
  await client.execute('DELETE FROM subscriptions');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  await client.execute('DELETE FROM contracts');
  sendSubscriptionOperatorAlert.mockReset();
  sendSubscriptionOperatorAlert.mockResolvedValue(null);
  issueBillingKey.mockReset();
  chargeBillingKey.mockReset();
  fetchPaymentByOrderId.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  client.close();
});

const lessonInput = {
  kind: 'lesson' as const,
  customerName: '김수강',
  customerPhone: '010-1234-5678',
  customerEmail: 'student@example.com',
  billingDay: 5,
};

const insertContract = async (id: string): Promise<string> => {
  await client.execute({
    sql: `INSERT INTO contracts (id, title, customer_name, customer_email, customer_phone, room_number,
            start_date, end_date, monthly_rent, deposit_amount, payment_day, content, status, sign_token)
          VALUES (?, '연습실 이용계약', '박연주', 'p@example.com', '010-0000-0000', 'A-1',
            0, 0, 360000, 0, 5, '본문', 'signed', ?)`,
    args: [id, `tok_${id}`],
  });
  return id;
};

/** 어떤 구독·회차의 orders.orderNo를 찾는다 — 재조회 mock에 orderId를 넣어 줄 때 쓴다. */
/** 그 회차의 주문번호. 같은 달에 시도가 여러 번이면 `attempt`로 고른다. */
const orderNoForCycle = async (subscriptionId: string, cycleYm: string, attempt?: number): Promise<string> => {
  const row = await mockDb.query.subscriptionPayments.findFirst({
    where: (t, { and: is, eq: eq_ }) =>
      is(
        eq_(t.subscriptionId, subscriptionId),
        eq_(t.cycleYm, cycleYm),
        ...(attempt === undefined ? [] : [eq_(t.attempt, attempt)]),
      ),
    with: { order: true },
  });
  return row!.order!.orderNo;
};

/** 생성 → 카드 등록 → 첫 결제 성공까지. 대부분의 테스트가 여기서 시작한다. */
const activated = async (now = NOW) => {
  const created = await createSubscription(lessonInput, now);
  if (!created.ok) throw new Error('unreachable');
  issueBillingKey.mockResolvedValue(issuedOk());
  chargeBillingKey.mockResolvedValue(chargeOk());
  const sub = (await findSubscriptionById(created.id))!;
  const setup = await completeCardSetup(
    { id: created.id, token: created.setupToken, authKey: 'auth_1', customerKey: sub.customerKey },
    now,
  );
  return { created, setup, customerKey: sub.customerKey };
};

describe('createSubscription', () => {
  it('레슨 구독을 pending_card로 만들고 토큰 두 개를 돌려준다', async () => {
    const result = await createSubscription(lessonInput, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const sub = (await findSubscriptionById(result.id))!;
    expect(sub.status).toBe('pending_card');
    expect(sub.totalAmount).toBe(LESSON_TOTAL);
    expect(sub.customerKey.startsWith('sub_')).toBe(true);
    expect(sub.setupToken).toBe(result.setupToken);
    expect(sub.manageToken).toBe(result.manageToken);
  });

  it('연습실은 계약 없이 만들 수 없다', async () => {
    const result = await createSubscription({ ...lessonInput, kind: 'practice-room' }, NOW);
    expect(result).toEqual({ ok: false, code: 'contract_required' });
  });

  it('같은 계약에 진행 중인 구독이 있으면 already_exists', async () => {
    const contractId = await insertContract('c1');
    const first = await createSubscription({ ...lessonInput, kind: 'practice-room', contractId }, NOW);
    expect(first.ok).toBe(true);
    const second = await createSubscription({ ...lessonInput, kind: 'practice-room', contractId }, NOW);
    expect(second).toEqual({ ok: false, code: 'already_exists' });
  });

  it('해지된 구독은 자리를 막지 않는다 — 재계약으로 새 구독을 만들 수 있다', async () => {
    const contractId = await insertContract('c2');
    const first = await createSubscription({ ...lessonInput, kind: 'practice-room', contractId }, NOW);
    if (!first.ok) throw new Error('unreachable');
    await cancelSubscription(first.id, { requestedBy: 'admin', reason: '퇴실' }, NOW);
    const second = await createSubscription({ ...lessonInput, kind: 'practice-room', contractId }, NOW);
    expect(second.ok).toBe(true);
  });

  it('billingDay 범위를 벗어나면 거부', async () => {
    expect(await createSubscription({ ...lessonInput, billingDay: 0 }, NOW)).toEqual({ ok: false, code: 'invalid_billing_day' });
    expect(await createSubscription({ ...lessonInput, billingDay: 32 }, NOW)).toEqual({ ok: false, code: 'invalid_billing_day' });
  });
});

describe('토큰', () => {
  it('setupToken은 7일 뒤 만료된다', async () => {
    const created = await createSubscription(lessonInput, NOW);
    if (!created.ok) throw new Error('unreachable');
    const late = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(await findSubscriptionForSetup(created.id, created.setupToken, late)).toEqual({ ok: false, code: 'expired' });
    expect((await findSubscriptionForSetup(created.id, created.setupToken, NOW)).ok).toBe(true);
  });

  it('setupToken은 1회성 — 카드 등록 성공 뒤 같은 링크는 used', async () => {
    const { created } = await activated();
    expect(await findSubscriptionForSetup(created.id, created.setupToken, NOW)).toEqual({ ok: false, code: 'used' });
  });

  it('틀린 토큰은 not_found로만 답한다 (존재 여부를 흘리지 않는다)', async () => {
    const created = await createSubscription(lessonInput, NOW);
    if (!created.ok) throw new Error('unreachable');
    expect(await findSubscriptionForSetup(created.id, 'wrong', NOW)).toEqual({ ok: false, code: 'not_found' });
    expect(await findSubscriptionForManage(created.id, 'wrong')).toEqual({ ok: false, code: 'not_found' });
    expect((await findSubscriptionForManage(created.id, created.manageToken)).ok).toBe(true);
  });
});

describe('completeCardSetup', () => {
  it('발급 → 카드 저장 → 첫 결제 → active', async () => {
    const { created, setup } = await activated();
    expect(setup).toMatchObject({ ok: true, charged: true, status: 'active' });
    const details = (await getSubscriptionWithDetails(created.id))!;
    expect(details.subscription.status).toBe('active');
    expect(details.billingKey?.cardNumberMasked).toBe('433012******1234');
    expect(details.payments).toHaveLength(1);
    expect(details.payments[0]).toMatchObject({ status: 'paid', cycleYm: '2026-03', attempt: 1 });
    // 회차마다 orders 1건 + payments 1건 — 기존 관리자·환불 도구가 그대로 쓴다.
    const orderRows = await client.execute("SELECT type, status FROM orders");
    expect(orderRows.rows).toHaveLength(1);
    expect(orderRows.rows[0]).toMatchObject({ type: 'subscription', status: 'paid' });
    expect((await client.execute('SELECT * FROM payments')).rows).toHaveLength(1);
    // 다음 청구는 다음 달 결제일 09:00 KST.
    expect(details.subscription.nextBillingAt?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    expect(details.subscription.currentPeriodEnd?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });

  it('customerKey가 DB와 다르면 발급도 하지 않는다', async () => {
    const created = await createSubscription(lessonInput, NOW);
    if (!created.ok) throw new Error('unreachable');
    const result = await completeCardSetup(
      { id: created.id, token: created.setupToken, authKey: 'auth_1', customerKey: 'sub_other' },
      NOW,
    );
    expect(result).toMatchObject({ ok: false, code: 'customer_key_mismatch' });
    expect(issueBillingKey).not.toHaveBeenCalled();
  });

  it('첫 결제 실패면 카드는 남기고 pending_card를 유지한다', async () => {
    const created = await createSubscription(lessonInput, NOW);
    if (!created.ok) throw new Error('unreachable');
    issueBillingKey.mockResolvedValue(issuedOk());
    chargeBillingKey.mockResolvedValue(chargeFail());
    const sub = (await findSubscriptionById(created.id))!;
    const result = await completeCardSetup(
      { id: created.id, token: created.setupToken, authKey: 'auth_1', customerKey: sub.customerKey },
      NOW,
    );
    expect(result).toMatchObject({ ok: false, code: 'first_charge_failed' });
    const details = (await getSubscriptionWithDetails(created.id))!;
    expect(details.subscription.status).toBe('pending_card');
    expect(details.billingKey).not.toBeNull(); // 키는 보존
    // 첫 결제 실패는 재시도 일정을 걸지 않는다 — 고객이 다른 카드로 다시 등록해야 한다.
    expect(details.subscription.nextBillingAt).toBeNull();
    expect(details.payments[0]).toMatchObject({ status: 'failed', tossCode: 'REJECT_CARD_COMPANY' });
  });
});

describe('chargeCycle — cron 청구와 재시도', () => {
  it('멱등키에 attempt가 들어간다 — 재시도가 최초 실패 응답을 replay하지 않게', async () => {
    const { created } = await activated();
    const april = new Date('2026-04-05T00:00:00Z');
    chargeBillingKey.mockResolvedValue(chargeFail());
    await chargeCycle(created.id, april, { reason: 'scheduled' });
    await chargeCycle(created.id, new Date('2026-04-06T00:00:00Z'), { reason: 'retry' });

    const keys = chargeBillingKey.mock.calls.map((c) => (c[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys[0]).toBe(chargeIdempotencyKey(created.id, '2026-03', 1)); // 첫 결제
    expect(keys[1]).toBe(chargeIdempotencyKey(created.id, '2026-04', 1));
    expect(keys[2]).toBe(chargeIdempotencyKey(created.id, '2026-04', 2));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('실패 → past_due(+1일) → 재실패(+3일) → 3회째 실패는 paused', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue(chargeFail());

    const first = await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    expect(first).toMatchObject({ ok: false, status: 'past_due', attempt: 1 });
    expect((await findSubscriptionById(created.id))!.nextBillingAt?.toISOString()).toBe('2026-04-06T00:00:00.000Z');

    const second = await chargeCycle(created.id, new Date('2026-04-06T00:00:00Z'), { reason: 'retry' });
    expect(second).toMatchObject({ ok: false, status: 'past_due', attempt: 2 });
    expect((await findSubscriptionById(created.id))!.nextBillingAt?.toISOString()).toBe('2026-04-09T00:00:00.000Z');

    const third = await chargeCycle(created.id, new Date('2026-04-09T00:00:00Z'), { reason: 'retry' });
    expect(third).toMatchObject({ ok: false, status: 'paused', attempt: 3 });
    expect((await findSubscriptionById(created.id))!.status).toBe('paused');
  });

  it('재시도가 성공하면 active로 돌아오고 기간이 전진한다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValueOnce(chargeFail());
    await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    chargeBillingKey.mockResolvedValue(chargeOk('pay_2'));
    const retry = await chargeCycle(created.id, new Date('2026-04-06T00:00:00Z'), { reason: 'retry' });
    expect(retry).toMatchObject({ ok: true, status: 'active', attempt: 2 });
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('active');
    expect(sub.nextBillingAt?.toISOString()).toBe('2026-05-05T00:00:00.000Z');
  });

  it('NETWORK_ERROR는 orders를 failed로 확정하지 않는다 (승인됐을 수 있다 — #42 규칙)', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });

    const rows = await client.execute("SELECT status FROM orders ORDER BY created_at");
    const statuses = rows.rows.map((r) => r.status);
    expect(statuses).toContain('pending');
    expect(statuses).not.toContain('failed');
    // 회차 기록은 실패로 남되, 재조회가 필요하다는 로그가 남는다.
    const details = (await getSubscriptionWithDetails(created.id))!;
    expect(details.payments[0]).toMatchObject({ status: 'failed', tossCode: 'NETWORK_ERROR' });
  });

  it('카드사 거절은 orders를 failed로 확정한다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue(chargeFail());
    await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    const rows = await client.execute("SELECT status FROM orders ORDER BY created_at");
    expect(rows.rows.map((r) => r.status)).toEqual(['paid', 'failed']);
  });

  it('같은 달에 이미 성공한 회차가 있으면 다시 청구하지 않는다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockClear();
    const again = await chargeCycle(created.id, NOW, { reason: 'scheduled' });
    expect(again).toMatchObject({ ok: true, attempt: 1 });
    expect(chargeBillingKey).not.toHaveBeenCalled();
  });

  it('paused는 자동 청구 대상이 아니지만 관리자 수동 결제는 통과한다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue(chargeFail());
    for (const [day, reason] of [['2026-04-05', 'scheduled'], ['2026-04-06', 'retry'], ['2026-04-09', 'retry']] as const) {
      await chargeCycle(created.id, new Date(`${day}T00:00:00Z`), { reason });
    }
    expect((await findSubscriptionById(created.id))!.status).toBe('paused');

    chargeBillingKey.mockClear();
    const scheduled = await chargeCycle(created.id, new Date('2026-04-10T00:00:00Z'), { reason: 'scheduled' });
    expect(scheduled.ok).toBe(false);
    expect(chargeBillingKey).not.toHaveBeenCalled();

    chargeBillingKey.mockResolvedValue(chargeOk('pay_manual'));
    const manual = await chargeCycle(created.id, new Date('2026-04-10T00:00:00Z'), { reason: 'manual' });
    expect(manual).toMatchObject({ ok: true, status: 'active', attempt: 4 });
  });
});

describe('chargeCycle — 이전 pending 회차 재조회 대사 (unresolved)', () => {
  /** NETWORK_ERROR로 4월 회차를 pending에 남긴 상태를 만든다(past_due, nextBillingAt=4/6). */
  const leaveNetworkErrorPending = async (subscriptionId: string) => {
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    await chargeCycle(subscriptionId, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    expect((await findSubscriptionById(subscriptionId))!.status).toBe('past_due');
    chargeBillingKey.mockClear();
  };

  it('재조회 DONE이면 새 청구 없이 그 회차로 종료 — active·nextBillingAt 미래·charge 호출 0회', async () => {
    const { created } = await activated();
    await leaveNetworkErrorPending(created.id);
    const orderNo = await orderNoForCycle(created.id, '2026-04');

    fetchPaymentByOrderId.mockResolvedValue({
      ok: true,
      payment: { paymentKey: 'pay_recovered', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
    });

    const april6 = new Date('2026-04-06T00:00:00Z');
    const result = await chargeCycle(created.id, april6, { reason: 'retry' });

    expect(result).toMatchObject({ ok: true, status: 'active', cycleYm: '2026-04' });
    expect(chargeBillingKey).not.toHaveBeenCalled();
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('active');
    expect(sub.nextBillingAt!.getTime()).toBeGreaterThan(april6.getTime());
    expect(sub.nextBillingAt?.toISOString()).toBe('2026-05-05T00:00:00.000Z');
  });

  it('재조회 자체가 실패(NETWORK_ERROR)하면 청구를 보류한다 — charge 호출 0회, orders는 pending 유지', async () => {
    const { created } = await activated();
    await leaveNetworkErrorPending(created.id);

    fetchPaymentByOrderId.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });

    const april6 = new Date('2026-04-06T00:00:00Z');
    const result = await chargeCycle(created.id, april6, { reason: 'retry' });

    expect(result.ok).toBe(false);
    expect(chargeBillingKey).not.toHaveBeenCalled();
    const rows = await client.execute("SELECT status FROM orders ORDER BY created_at");
    expect(rows.rows.map((r) => r.status)).toEqual(['paid', 'pending']); // 4월 회차는 여전히 미확정
  });

  it('재조회 결과가 DONE이 아니면(예: EXPIRED) 그 회차를 failed로 확정한 뒤 정상 청구를 진행한다', async () => {
    const { created } = await activated();
    await leaveNetworkErrorPending(created.id);
    const orderNo = await orderNoForCycle(created.id, '2026-04');

    fetchPaymentByOrderId.mockResolvedValue({
      ok: true,
      payment: { paymentKey: 'pay_never', orderId: orderNo, status: 'EXPIRED', totalAmount: LESSON_TOTAL },
    });
    chargeBillingKey.mockResolvedValue(chargeOk('pay_new_attempt'));

    const april6 = new Date('2026-04-06T00:00:00Z');
    const result = await chargeCycle(created.id, april6, { reason: 'retry' });

    expect(result).toMatchObject({ ok: true, status: 'active', attempt: 2 });
    expect(chargeBillingKey).toHaveBeenCalledTimes(1);
    const rows = await client.execute("SELECT status FROM orders ORDER BY created_at");
    expect(rows.rows.map((r) => r.status)).toEqual(['paid', 'failed', 'paid']); // 첫 결제 / 재조회로 확정한 stale 4월 시도 / 새 4월 시도
  });
});

/**
 * `paused` 하나에 성질이 정반대인 둘(결제 실패 / 운영자 정지)이 들어 있어, 운영자가 세워 둔
 * 정상 구독이 방치 판정에 걸려 되돌릴 수 없이 닫히던 문제의 회귀 테스트.
 * 값을 **채우는 두 경로**와 **비우는 경로**를 각각 본다.
 */
describe('정지 사유(pausedReason)', () => {
  /** 재시도 한도를 소진시켜 시스템이 세운 paused를 만든다. */
  const exhaustRetries = async (id: string) => {
    chargeBillingKey.mockResolvedValue(chargeFail());
    for (const [day, reason] of [['2026-04-05', 'scheduled'], ['2026-04-06', 'retry'], ['2026-04-09', 'retry']] as const) {
      await chargeCycle(id, new Date(`${day}T00:00:00Z`), { reason });
    }
  };

  it('재시도 한도 소진으로 세워지면 payment_failed가 적힌다', async () => {
    const { created } = await activated();
    await exhaustRetries(created.id);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('payment_failed');
  });

  it('재시도 대기(past_due) 동안에는 사유가 비어 있다 — 아직 정지가 아니다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue(chargeFail());
    await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('past_due');
    expect(sub.pausedReason).toBeNull();
  });

  it('운영자 정지는 operator가 적힌다 — 결제 실패와 같은 값을 쓰지 않는다', async () => {
    const { created } = await activated();
    const paused = await pauseSubscription(created.id, PAUSE_UNTIL, new Date('2026-04-01T00:00:00Z'));
    expect(paused.ok).toBe(true);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('operator');
  });

  it('재개하면 사유를 비운다 — active 행이 옛 사유를 달고 다니면 안 된다', async () => {
    const { created } = await activated();
    await pauseSubscription(created.id, PAUSE_UNTIL, new Date('2026-04-01T00:00:00Z'));
    const resumed = await resumeSubscription(created.id, new Date('2026-04-02T00:00:00Z'));
    expect(resumed.ok).toBe(true);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('active');
    expect(sub.pausedReason).toBeNull();
  });

  it('청구가 성공해 active로 돌아와도 사유를 비운다', async () => {
    const { created } = await activated();
    await exhaustRetries(created.id);
    expect((await findSubscriptionById(created.id))!.pausedReason).toBe('payment_failed');

    chargeBillingKey.mockResolvedValue(chargeOk('pay_manual'));
    const manual = await chargeCycle(created.id, new Date('2026-04-10T00:00:00Z'), { reason: 'manual' });
    expect(manual).toMatchObject({ ok: true, status: 'active' });
    expect((await findSubscriptionById(created.id))!.pausedReason).toBeNull();
  });

  /**
   * **이 기능의 유일한 방어가 클릭 한 번으로 꺼지던 자리.**
   *
   * 관리자 화면의 '결제' 버튼은 `paused`에서도 눌린다. 그 수동 결제가 거절됐을 때
   * `attempt < MAX`라는 이유로 `past_due`로 내려보내면 `paused_reason`이 지워지고
   * 청구 크론이 그 카드를 다시 긁기 시작한다 — 운영자가 멈춰 둔 구독에서 돈이 나가고,
   * 재시도가 다 실패하면 `payment_failed`로 앉아 종료 경보가 조용해진다.
   */
  it('정지된 구독의 수동 결제가 실패해도 paused·operator가 유지된다', async () => {
    const { created } = await activated();
    await pauseSubscription(created.id, PAUSE_UNTIL, new Date('2026-04-01T00:00:00Z'));

    chargeBillingKey.mockResolvedValue(chargeFail());
    const manual = await chargeCycle(created.id, new Date('2026-04-10T00:00:00Z'), { reason: 'manual' });
    expect(manual).toMatchObject({ ok: false, status: 'paused' });

    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('operator');
  });

  it('그 실패가 자동 재시도 일정을 되살리지 않는다 — cron이 그 구독을 집지 않는다', async () => {
    const { created } = await activated();
    await pauseSubscription(created.id, PAUSE_UNTIL, new Date('2026-04-01T00:00:00Z'));
    chargeBillingKey.mockResolvedValue(chargeFail());
    await chargeCycle(created.id, new Date('2026-04-10T00:00:00Z'), { reason: 'manual' });

    const due = await listDueSubscriptions(new Date('2026-05-01T00:00:00Z'));
    expect(due.map((d) => d.id)).not.toContain(created.id);
  });

  /**
   * 실패와 달리 **성공은 되살린다.** 승인이 이용기간을 전진시키고 nextBillingAt을 다음 달로
   * 잡으므로, `paused`로 두면 돈은 받았는데 멈췄다고 적힌 행이 남고 그 상태에서 '재개'를
   * 누르면 방금 결제한 달을 또 긁는다.
   */
  it('정지된 구독의 수동 결제가 성공하면 active가 되고 사유를 비운다', async () => {
    const { created } = await activated();
    await pauseSubscription(created.id, PAUSE_UNTIL, new Date('2026-04-01T00:00:00Z'));

    chargeBillingKey.mockResolvedValue(chargeOk('pay_manual_ok'));
    const manual = await chargeCycle(created.id, new Date('2026-04-10T00:00:00Z'), { reason: 'manual' });
    expect(manual).toMatchObject({ ok: true, status: 'active' });

    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('active');
    expect(sub.pausedReason).toBeNull();
  });

  /**
   * 운영자 정지 → 재개 → 결제 실패로 다시 정지. 재개가 값을 비우지 않으면 여기서 operator가
   * 그대로 남아, 카드가 죽은 구독이 "운영자가 세워 둔 것"으로 읽혀 경보가 영영 안 꺼진다.
   */
  it('운영자 정지 후 재개했다가 결제 실패로 다시 정지되면 payment_failed로 바뀐다', async () => {
    const { created } = await activated();
    await pauseSubscription(created.id, PAUSE_UNTIL, new Date('2026-04-01T00:00:00Z'));
    await resumeSubscription(created.id, new Date('2026-04-02T00:00:00Z'));
    await exhaustRetries(created.id);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('payment_failed');
  });
});

describe('카드 재등록', () => {
  it('paused에서 카드를 다시 넣으면 기존 키는 revoke되고 미납분 결제로 active가 된다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue(chargeFail());
    for (const day of ['2026-04-05', '2026-04-06', '2026-04-09']) {
      await chargeCycle(created.id, new Date(`${day}T00:00:00Z`), { reason: 'scheduled' });
    }
    expect((await findSubscriptionById(created.id))!.status).toBe('paused');

    const changeAt = new Date('2026-04-10T00:00:00Z');
    const token = await issueCardChangeToken(created.id, changeAt);
    if (!token.ok) throw new Error('unreachable');
    issueBillingKey.mockResolvedValue(issuedOk('bkey_2'));
    const sub = (await findSubscriptionById(created.id))!;
    const setup = await completeCardSetup(
      { id: created.id, token: token.setupToken, authKey: 'auth_2', customerKey: sub.customerKey },
      changeAt,
    );
    // 카드 교체 모드라 등록만으로는 결제하지 않는다 — 여기서 청구하면 카드만 바꾼 고객에게 한 달치가 더 나간다.
    expect(setup).toMatchObject({ ok: true, charged: false });
    const keys = await client.execute('SELECT billing_key, revoked_at FROM billing_keys ORDER BY issued_at');
    expect(keys.rows[0].revoked_at).not.toBeNull();
    expect(keys.rows[1]).toMatchObject({ billing_key: 'bkey_2', revoked_at: null });

    chargeBillingKey.mockResolvedValue(chargeOk('pay_after_change'));
    const manual = await chargeCycle(created.id, changeAt, { reason: 'manual' });
    expect(manual.ok).toBe(true);
    expect((await findSubscriptionById(created.id))!.status).toBe('active');
    // 새 카드로 결제됐는지 — 옛 키가 남아 있으면 revoke가 무의미하다.
    expect((chargeBillingKey.mock.calls.at(-1)![0] as { billingKey: string }).billingKey).toBe('bkey_2');
  });

  /**
   * 첫 결제가 카드사 거절로 실패하면 구독은 pending_card로 남는다. 관리자 상세 화면에는
   * 이 상태에서도 '카드 변경 링크 발급' 버튼이 떠 있는데, 그 링크에 setupMode='change'가
   * 걸리면 고객이 새 카드를 정상 등록해도 첫 결제가 건너뛰어진다 — 카드는 붙었고 고객은
   * '등록 완료' 화면을 봤는데 status는 pending_card, nextBillingAt은 null이라
   * listDueSubscriptions가 영원히 집지 않고 첫 달치가 조용히 미청구로 남는다.
   */
  it('pending_card에 발급한 링크는 initial이라, 새 카드 등록과 함께 첫 결제가 돈다', async () => {
    const created = await createSubscription(lessonInput, NOW);
    if (!created.ok) throw new Error('unreachable');
    issueBillingKey.mockResolvedValue(issuedOk());
    chargeBillingKey.mockResolvedValue(chargeFail());
    const sub = (await findSubscriptionById(created.id))!;
    // 첫 결제가 카드사 거절 → pending_card로 남는다(재시도 일정 없음).
    await completeCardSetup({ id: created.id, token: created.setupToken, authKey: 'auth_1', customerKey: sub.customerKey }, NOW);
    expect((await findSubscriptionById(created.id))!.status).toBe('pending_card');

    const changeAt = new Date('2026-03-06T00:00:00Z');
    const token = await issueCardChangeToken(created.id, changeAt);
    if (!token.ok) throw new Error('unreachable');
    expect((await findSubscriptionById(created.id))!.setupMode).toBe('initial');

    issueBillingKey.mockResolvedValue(issuedOk('bkey_2'));
    chargeBillingKey.mockResolvedValue(chargeOk('pay_first_retry'));
    const setup = await completeCardSetup(
      { id: created.id, token: token.setupToken, authKey: 'auth_2', customerKey: sub.customerKey },
      changeAt,
    );
    expect(setup).toMatchObject({ ok: true, charged: true });
    const after = (await findSubscriptionById(created.id))!;
    expect(after.status).toBe('active');
    expect(after.nextBillingAt).not.toBeNull();
  });

  it('청구가 도는 구독(active)의 카드 교체는 그대로 change — 등록만으로 한 달치가 더 나가지 않는다', async () => {
    const { created } = await activated();
    const token = await issueCardChangeToken(created.id, new Date('2026-03-10T00:00:00Z'));
    expect(token.ok).toBe(true);
    expect((await findSubscriptionById(created.id))!.setupMode).toBe('change');
  });
});

describe('해지·정지·재개·만료', () => {
  it('해지는 endsAt을 현재 기간 끝으로 잡고, 그 시각이 지나면 ended', async () => {
    const { created } = await activated();
    const cancelled = await cancelSubscription(created.id, { requestedBy: 'customer', reason: '수강 종료' }, NOW);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) throw new Error('unreachable');
    expect(cancelled.subscription.status).toBe('cancelled');
    expect(cancelled.subscription.endsAt?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    // 해지 후에는 어떤 경로로도 청구되지 않는다.
    expect(cancelled.subscription.nextBillingAt).toBeNull();
    expect(await listDueSubscriptions(new Date('2026-04-05T00:00:00Z'))).toHaveLength(0);

    expect(await endExpiredSubscriptions(new Date('2026-04-04T00:00:00Z'))).toBe(0);
    expect(await endExpiredSubscriptions(new Date('2026-04-05T00:00:00Z'))).toBe(1);
    expect((await findSubscriptionById(created.id))!.status).toBe('ended');
  });

  it('이미 해지·종료된 구독은 다시 해지할 수 없다', async () => {
    const { created } = await activated();
    await cancelSubscription(created.id, { requestedBy: 'admin', reason: 'x' }, NOW);
    expect(await cancelSubscription(created.id, { requestedBy: 'admin', reason: 'x' }, NOW)).toEqual({
      ok: false,
      code: 'invalid_state',
    });
  });

  it('해지된 구독은 청구되지 않는다', async () => {
    const { created } = await activated();
    await cancelSubscription(created.id, { requestedBy: 'customer', reason: 'x' }, NOW);
    chargeBillingKey.mockClear();
    const result = await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    expect(result.ok).toBe(false);
    expect(chargeBillingKey).not.toHaveBeenCalled();
  });

  it('일시정지는 청구를 멈추고, 재개는 nextBillingAt을 당겨 다음 cron이 바로 청구한다', async () => {
    const { created } = await activated();
    expect((await pauseSubscription(created.id, PAUSE_UNTIL, NOW)).ok).toBe(true);
    expect(await listDueSubscriptions(new Date('2026-05-05T00:00:00Z'))).toHaveLength(0);

    const resumeAt = new Date('2026-04-20T00:00:00Z');
    const resumed = await resumeSubscription(created.id, resumeAt);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) throw new Error('unreachable');
    expect(resumed.subscription.nextBillingAt?.toISOString()).toBe(resumeAt.toISOString());
    const due = await listDueSubscriptions(resumeAt);
    expect(due.map((s) => s.id)).toEqual([created.id]);
  });

  it('listDueSubscriptions는 active·past_due 중 nextBillingAt이 지난 것만 준다', async () => {
    const { created } = await activated();
    expect(await listDueSubscriptions(new Date('2026-04-04T00:00:00Z'))).toHaveLength(0);
    expect((await listDueSubscriptions(new Date('2026-04-05T00:00:00Z'))).map((s) => s.id)).toEqual([created.id]);
  });
});

describe('claimDueSubscription — cron 동시 실행 방어', () => {
  it('현재 nextBillingAt과 일치할 때만 선점에 성공한다', async () => {
    const { created } = await activated();
    const expected = (await findSubscriptionById(created.id))!.nextBillingAt!;
    expect(expected.toISOString()).toBe('2026-04-05T00:00:00.000Z');

    const first = await claimDueSubscription(created.id, expected);
    expect(first).toBe(true);

    // 같은 값으로 다시 선점하면 실패한다 — claim이 이미 값을 앞당겨 놔서 더 이상 일치하지 않는다.
    const second = await claimDueSubscription(created.id, expected);
    expect(second).toBe(false);
  });

  it('선점은 chargeCycle의 정상 진행을 막지 않는다 — 성공 시 nextBillingAt을 스스로 재계산해 덮어쓴다', async () => {
    const { created } = await activated();
    const expected = (await findSubscriptionById(created.id))!.nextBillingAt!;
    expect(await claimDueSubscription(created.id, expected)).toBe(true);

    chargeBillingKey.mockResolvedValue(chargeOk('pay_after_claim'));
    const result = await chargeCycle(created.id, expected, { reason: 'scheduled' });
    expect(result).toMatchObject({ ok: true, status: 'active' });
    expect((await findSubscriptionById(created.id))!.nextBillingAt?.toISOString()).toBe('2026-05-05T00:00:00.000Z');
  });
});

describe('chargeCycle — 승인 왕복 중 들어온 해지', () => {
  /**
   * chargeCycle은 진입부에서 status를 **한 번** 읽고 통과시킨 뒤 토스에 HTTP로 청구한다
   * (통상 1~3초). 그 사이 고객이 관리 페이지에서 셀프 해지를 누르면, 성공 batch가 상태를
   * 보지 않고 active로 덮어써 해지가 사라진다. 같은 batch의 orders는 여전히 pending이라
   * 기존 0행 경보도 울리지 않는다 — 조용히 다음 달 재청구로 이어진다.
   */
  it('승인 왕복 중 해지가 들어오면 active로 되돌리지 않는다', async () => {
    const { created } = await activated();
    const april = new Date('2026-04-05T00:00:00Z');
    // 토스 왕복 "도중"에 셀프 해지가 들어오는 상황을 그대로 재현한다.
    chargeBillingKey.mockImplementation(async () => {
      await cancelSubscription(created.id, { requestedBy: 'customer', reason: '왕복 중 해지' }, april);
      return chargeOk('pay_race');
    });

    const result = await chargeCycle(created.id, april, { reason: 'scheduled' });
    expect(result.ok).toBe(true); // 승인 자체는 성공했다 — 회차는 paid로 남는다

    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('cancelled');
    expect(sub.nextBillingAt).toBeNull();
    expect(await listDueSubscriptions(new Date('2026-06-05T00:00:00Z'))).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('승인 후 구독 상태 전이 0행'),
      expect.objectContaining({ subscriptionId: created.id }),
    );
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id }),
      'late_approval',
      expect.stringContaining('환불'),
    );
  });
});

describe('reconcileSubscriptionPaymentFromToss — 웹훅 DONE 복구', () => {
  const orderNoOf = orderNoForCycle;

  it('NETWORK_ERROR로 pending에 남은 회차를 재조회 DONE으로 반영 — 기간을 전진시키고 active로 되돌린다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    const april = new Date('2026-04-05T00:00:00Z');
    await chargeCycle(created.id, april, { reason: 'scheduled' });

    // 이 시점: orders는 pending, subscriptionPayments는 failed(tossCode=NETWORK_ERROR) —
    // "물어보지도 못했다"는 뜻으로 확정하지 않은 상태(#42 규칙).
    const beforeOrders = await client.execute('SELECT status FROM orders ORDER BY created_at');
    expect(beforeOrders.rows.map((r) => r.status)).toEqual(['paid', 'pending']);

    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_recovered', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      april,
    );

    const afterOrders = await client.execute('SELECT status FROM orders ORDER BY created_at');
    expect(afterOrders.rows.map((r) => r.status)).toEqual(['paid', 'paid']);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('active');
    expect(sub.nextBillingAt?.toISOString()).toBe('2026-05-05T00:00:00.000Z');
    const details = (await getSubscriptionWithDetails(created.id))!;
    expect(details.payments.find((p) => p.cycleYm === '2026-04')).toMatchObject({ status: 'paid', paymentKey: 'pay_recovered' });
  });

  /**
   * **아무도 누르지 않아도 도는 경로다.** 운영자가 정지한 구독에 수동 결제를 눌렀다가
   * NETWORK_ERROR로 응답을 못 받으면 회차가 pending에 남고, 실제로는 승인돼 수분~수시간 뒤
   * DONE 웹훅이 온다. 그 웹훅이 `active`로 덮어쓰면 운영자가 세워 둔 구독이 말없이 살아나고
   * 정지였다는 기록까지 지워진다 — 다음 달부터 cron이 그 카드를 긁는다.
   */
  const pausedWithPendingCycle = async (
    pausedReason: 'operator' | 'payment_failed',
    april: Date,
  ) => {
    const { created } = await activated();
    if (pausedReason === 'operator') {
      await pauseSubscription(created.id, PAUSE_UNTIL, new Date('2026-04-01T00:00:00Z'));
      chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
      await chargeCycle(created.id, april, { reason: 'manual' });
    } else {
      // 재시도 한도를 소진시켜 payment_failed로 세운 뒤, 마지막 시도를 NETWORK_ERROR로 남긴다.
      chargeBillingKey.mockResolvedValue(chargeFail());
      await chargeCycle(created.id, april, { reason: 'scheduled' });
      await chargeCycle(created.id, new Date('2026-04-06T00:00:00Z'), { reason: 'retry' });
      chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
      await chargeCycle(created.id, new Date('2026-04-09T00:00:00Z'), { reason: 'retry' });
    }
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe(pausedReason);
    return created;
  };

  it('운영자 정지 구독에 뒤늦은 DONE이 와도 되살아나지 않는다 — 기간만 전진한다', async () => {
    const april = new Date('2026-04-05T00:00:00Z');
    const created = await pausedWithPendingCycle('operator', april);

    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_recovered_paused', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      april,
    );

    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('operator');
    // 돈은 실제로 들어왔으므로 그 달을 안 쓴 것으로 적을 수는 없다.
    expect(sub.currentPeriodEnd).not.toBeNull();
    const details = (await getSubscriptionWithDetails(created.id))!;
    expect(details.payments.find((p) => p.cycleYm === '2026-04')).toMatchObject({ status: 'paid' });
  });

  it('그래서 cron이 그 구독을 다시 긁지 않는다', async () => {
    const april = new Date('2026-04-05T00:00:00Z');
    const created = await pausedWithPendingCycle('operator', april);
    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_recovered_paused2', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      april,
    );

    const due = await listDueSubscriptions(new Date('2026-06-01T00:00:00Z'));
    expect(due.map((d) => d.id)).not.toContain(created.id);
  });

  it('되살리지 않은 대신 운영자에게 알린다 — 재개할지 환불할지는 사람이 정한다', async () => {
    const april = new Date('2026-04-05T00:00:00Z');
    const created = await pausedWithPendingCycle('operator', april);
    sendSubscriptionOperatorAlert.mockClear();
    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_recovered_paused3', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      april,
    );

    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledTimes(1);
    expect(sendSubscriptionOperatorAlert.mock.calls[0][1]).toBe('paused_late_approval');
  });

  /**
   * 정지를 지키는 batch의 WHERE는 `status = 'paused'`라, 읽은 뒤 이 순간 사이에 해지가
   * 들어오면 0행이 된다. 그 조합에 **아무 알림도 없으면** 돈은 들어왔는데 구독은 끝났고
   * 이용기간도 안 늘어난 건이 조용히 묻힌다 — `late_approval` 알림이 있는 이유가 그것이다.
   *
   * 반영 "도중"의 해지를 db.batch 직전에 끼워 넣어 그대로 재현한다.
   */
  it('정지 구독에 반영하는 사이 해지가 들어와 0행이 되면 알린다', async () => {
    const april = new Date('2026-04-05T00:00:00Z');
    const created = await pausedWithPendingCycle('operator', april);
    sendSubscriptionOperatorAlert.mockClear();

    const realBatch = mockDb.batch.bind(mockDb);
    jest
      .spyOn(mockDb, 'batch')
      .mockImplementationOnce((async (stmts: Parameters<typeof realBatch>[0]) => {
        await cancelSubscription(created.id, { requestedBy: 'customer', reason: '반영 중 해지' }, april);
        return realBatch(stmts);
      }) as unknown as typeof realBatch);

    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_race_paused', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      april,
    );

    expect((await findSubscriptionById(created.id))!.status).toBe('cancelled');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('정지 구독에 반영하는 사이 재개·해지 유입'),
      expect.objectContaining({ subscriptionId: created.id }),
    );
    // 문구는 '정지 구독에 반영하는 사이 재개·해지' 쪽이어야 한다 — 되살리기 쪽 문구가 아니다.
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id }),
      'late_approval',
      expect.stringContaining('반영하는 사이 재개 또는 해지가 들어와'),
    );
  });

  /**
   * `payment_failed` 정지는 되살린다. 그 정지의 뜻이 "카드가 안 된다"인데 승인이 확인된
   * 이상 전제가 사라졌다. 사유를 비우는 세 번째 경로이기도 하다.
   */
  it('결제 실패로 세워진 정지는 뒤늦은 DONE으로 되살아나고 사유를 비운다', async () => {
    const april = new Date('2026-04-05T00:00:00Z');
    const created = await pausedWithPendingCycle('payment_failed', april);

    const orderNo = await orderNoOf(created.id, '2026-04', 3);
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_recovered_failed', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      april,
    );

    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('active');
    expect(sub.pausedReason).toBeNull();
  });

  it('이미 paid로 반영된 주문은 다시 건드리지 않는다 (멱등)', async () => {
    const { created } = await activated();
    const orderNo = await orderNoOf(created.id, '2026-03');
    // activated()의 첫 결제는 이미 paid — 재도착 웹훅이 다시 와도 no-op이어야 한다.
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_1', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      NOW,
    );
    const sub = (await findSubscriptionById(created.id))!;
    // nextBillingAt이 그대로다 — 다시 반영했다면 5월로 또 전진했을 것이다.
    expect(sub.nextBillingAt?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });

  /**
   * 실제 동선: 청구가 NETWORK_ERROR로 끝나 결제 실패 메일이 나가고(회차는 pending으로 남는다),
   * 고객이 그 메일을 보고 관리 링크에서 셀프 해지를 누른다. 그런데 토스는 실제로 승인했었고
   * 뒤늦게 DONE 웹훅이 온다. 구독 status를 보지 않고 active로 덮어쓰면 해지가 조용히 사라지고
   * nextBillingAt이 다음 달로 다시 잡혀, **해지한 고객의 카드를 다음 cron이 또 긁는다.**
   * endsAt은 남지만 endExpiredSubscriptions는 status='cancelled'만 보므로 닫지도 못한다.
   */
  it('해지된 구독에 뒤늦은 DONE 웹훅이 와도 되살아나지 않는다 — 회차만 paid로 반영하고 알린다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    const april = new Date('2026-04-05T00:00:00Z');
    await chargeCycle(created.id, april, { reason: 'scheduled' });

    const cancelledAt = new Date('2026-04-06T00:00:00Z');
    expect((await cancelSubscription(created.id, { requestedBy: 'customer', reason: '결제 실패' }, cancelledAt)).ok).toBe(true);

    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_late', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      new Date('2026-04-07T00:00:00Z'),
    );

    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('cancelled');
    // 다음 결제일이 되살아나면 cron의 listDueSubscriptions가 이 구독을 다시 집는다.
    expect(sub.nextBillingAt).toBeNull();
    expect(await listDueSubscriptions(new Date('2026-06-05T00:00:00Z'))).toHaveLength(0);
    // 해지 예정일이 지나면 여전히 ended로 닫힌다(status가 cancelled로 남아 있어야 가능하다).
    expect(await endExpiredSubscriptions(new Date('2026-05-05T00:00:00Z'))).toBe(1);

    // 돈은 실제로 들어왔다 — 회차 기록은 그대로 paid로 반영한다.
    const orders = await client.execute('SELECT status FROM orders ORDER BY created_at');
    expect(orders.rows.map((r) => r.status)).toEqual(['paid', 'paid']);
    const details = (await getSubscriptionWithDetails(created.id))!;
    expect(details.payments.find((p) => p.cycleYm === '2026-04')).toMatchObject({ status: 'paid', paymentKey: 'pay_late' });
    // 환불 여부는 사람이 판단해야 하므로 조용히 넘어가지 않는다.
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('해지·종료된 구독에 뒤늦은 승인 도착'),
      expect.objectContaining({ subscriptionId: created.id }),
    );
    // 로그만으로는 아무도 못 본다(Vercel 런타임 로그뿐) — 운영자 메일까지 나가야 한다.
    // 같은 형태의 사고를 PR #59에서 이미 한 번 고쳤다.
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id }),
      'late_approval',
      expect.stringContaining('환불'),
    );
  });

  it('종료(ended)된 구독도 되살아나지 않는다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    const april = new Date('2026-04-05T00:00:00Z');
    await chargeCycle(created.id, april, { reason: 'scheduled' });
    await cancelSubscription(created.id, { requestedBy: 'customer', reason: '종료' }, april);
    expect(await endExpiredSubscriptions(new Date('2026-05-05T00:00:00Z'))).toBe(1);
    expect((await findSubscriptionById(created.id))!.status).toBe('ended');

    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_late_2', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      new Date('2026-05-06T00:00:00Z'),
    );
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('ended');
    expect(sub.nextBillingAt).toBeNull();
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(expect.objectContaining({ id: created.id }), 'late_approval', expect.any(String));
  });

  it('운영자 알림 발송이 실패하면 notificationError에 남긴다 — 조용히 삼키지 않는다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    const april = new Date('2026-04-05T00:00:00Z');
    await chargeCycle(created.id, april, { reason: 'scheduled' });
    await cancelSubscription(created.id, { requestedBy: 'customer', reason: '결제 실패' }, april);
    sendSubscriptionOperatorAlert.mockResolvedValue('operator:send_failed');

    const orderNo = await orderNoOf(created.id, '2026-04');
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_late_3', orderId: orderNo, status: 'DONE', totalAmount: LESSON_TOTAL },
      april,
    );
    expect((await findSubscriptionById(created.id))!.notificationError).toBe('operator:send_failed');
  });

  it('CANCELED 등 DONE이 아닌 상태는 무시한다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    const april = new Date('2026-04-05T00:00:00Z');
    await chargeCycle(created.id, april, { reason: 'scheduled' });
    const orderNo = await orderNoOf(created.id, '2026-04');

    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_x', orderId: orderNo, status: 'CANCELED', totalAmount: LESSON_TOTAL },
      april,
    );
    const rows = await client.execute('SELECT status FROM orders ORDER BY created_at');
    expect(rows.rows.map((r) => r.status)).toContain('pending'); // 손대지 않았다
  });
});

/**
 * 운영자 정지의 만료일. 기한 없는 정지가 3년 뒤 되돌릴 수 없는 종료로 끝나던 경로를
 * 막는 장치라, "날짜가 오면 정확히 무엇이 일어나는가"가 전부 여기서 고정된다.
 */
describe('정지 만료일 — pausedUntil / resumeExpiredPauses', () => {
  const PAUSED_AT = new Date('2026-04-01T00:00:00Z');
  const UNTIL = new Date('2026-07-01T00:00:00Z');

  const pausedWithUntil = async (until: Date = UNTIL) => {
    const { created } = await activated();
    const result = await pauseSubscription(created.id, { pausedUntil: until }, PAUSED_AT);
    if (!result.ok) throw new Error(`unexpected: ${result.code}`);
    return created;
  };

  it('정지하면서 만료일을 받아 저장한다', async () => {
    const created = await pausedWithUntil();
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('operator');
    expect(sub.pausedUntil?.toISOString()).toBe(UNTIL.toISOString());
  });

  it('지난 날짜·오늘·최대 기한을 넘는 날짜는 거부한다 — 그 자리에서 풀리거나 사실상 방치가 된다', async () => {
    const { created } = await activated();
    for (const until of [
      new Date('2026-03-01T00:00:00Z'),
      PAUSED_AT,
      new Date(PAUSED_AT.getTime() + (MAX_PAUSE_DAYS + 1) * 24 * 60 * 60 * 1000),
    ]) {
      expect(await pauseSubscription(created.id, { pausedUntil: until }, PAUSED_AT)).toEqual({
        ok: false,
        code: 'invalid_pause_until',
      });
    }
    expect((await findSubscriptionById(created.id))!.status).toBe('active');
  });

  it('만료일 전에는 아무 일도 일어나지 않는다', async () => {
    const created = await pausedWithUntil();
    const before = new Date('2026-06-30T23:59:59Z');
    expect(await resumeExpiredPauses(before)).toEqual({ resumed: [], failed: [] });
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedUntil?.toISOString()).toBe(UNTIL.toISOString());
  });

  it('경계값 — 만료일 그 순간에 재개된다', async () => {
    const created = await pausedWithUntil();
    const result = await resumeExpiredPauses(UNTIL);
    expect(result.resumed.map((r) => r.subscription.id)).toEqual([created.id]);
    expect((await findSubscriptionById(created.id))!.status).toBe('active');
  });

  /**
   * **즉시 청구하지 않는다는 것이 이 기능의 핵심 판단이다.** 관리자 재개 버튼과 달리
   * 아무도 보고 있지 않은 자리라, nextBillingAt을 now로 당기면 살아 있는 카드가 예고 없이
   * 긁힌다. 고객이 원래 알고 있던 다음 정기 청구일을 잡는다.
   */
  it('재개는 즉시 청구하지 않고 다음 정기 청구일을 잡는다', async () => {
    const created = await pausedWithUntil();
    const result = await resumeExpiredPauses(UNTIL);
    const nextBillingAt = result.resumed[0].nextBillingAt;
    // billingDay 5, 만료일이 7월 → 8월 5일 09:00 KST
    expect(nextBillingAt.toISOString()).toBe('2026-08-05T00:00:00.000Z');

    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.nextBillingAt?.toISOString()).toBe(nextBillingAt.toISOString());
    expect(sub.pausedReason).toBeNull();
    expect(sub.pausedUntil).toBeNull();
    // 같은 cron 실행에서 청구 목록에 올라오지 않는다 — 재개가 청구 앞에 있어도 안전하다.
    expect(await listDueSubscriptions(UNTIL)).toHaveLength(0);
  });

  it('멱등 — 두 번 돌려도 한 번만 재개된다', async () => {
    await pausedWithUntil();
    expect((await resumeExpiredPauses(UNTIL)).resumed).toHaveLength(1);
    expect(await resumeExpiredPauses(UNTIL)).toEqual({ resumed: [], failed: [] });
  });

  it('한 건이 실패해도 나머지는 재개되고, 실패한 건은 상태가 그대로 남아 다음 실행이 다시 집는다', async () => {
    const first = await pausedWithUntil();
    // 두 번째는 카드까지 붙이지 않는다 — 이 테스트가 보는 것은 재개 루프의 실패 격리뿐이고,
    // activated()를 두 번 부르면 같은 빌링키를 두 번 발급해 unique에 걸린다.
    const second = await createSubscription({ ...lessonInput, customerEmail: 'b@example.com' }, PAUSED_AT);
    if (!second.ok) throw new Error('unreachable');
    await client.execute({
      sql: "UPDATE subscriptions SET status = 'paused', paused_reason = 'operator', paused_until = ? WHERE id = ?",
      args: [Math.floor(UNTIL.getTime() / 1000), second.id],
    });
    const update = jest.spyOn(mockDb, 'update');
    update.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const result = await resumeExpiredPauses(UNTIL);
    update.mockRestore();

    expect(result.failed).toHaveLength(1);
    expect(result.resumed).toHaveLength(1);
    const failedId = result.failed[0].subscriptionId;
    expect([first.id, second.id]).toContain(failedId);
    expect((await findSubscriptionById(failedId))!.status).toBe('paused');
    // 다음 실행이 남은 하나를 집는다.
    expect((await resumeExpiredPauses(UNTIL)).resumed.map((r) => r.subscription.id)).toEqual([failedId]);
  });

  it('만료일이 없는 옛 정지 행은 건드리지 않는다', async () => {
    const created = await pausedWithUntil();
    await client.execute({ sql: 'UPDATE subscriptions SET paused_until = NULL WHERE id = ?', args: [created.id] });
    expect(await resumeExpiredPauses(new Date('2030-01-01T00:00:00Z'))).toEqual({ resumed: [], failed: [] });
    expect((await findSubscriptionById(created.id))!.status).toBe('paused');
  });

  it('결제 실패로 세워진 정지는 기한이 없고 자동 재개 대상도 아니다 — 죽은 카드를 긁지 않는다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue(chargeFail());
    // 최초 + 재시도 2회로 한도를 소진시켜 payment_failed 정지를 만든다.
    await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    await chargeCycle(created.id, new Date('2026-04-06T00:00:00Z'), { reason: 'retry' });
    await chargeCycle(created.id, new Date('2026-04-08T00:00:00Z'), { reason: 'retry' });
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('payment_failed');
    expect(sub.pausedUntil).toBeNull();

    expect(await resumeExpiredPauses(new Date('2030-01-01T00:00:00Z'))).toEqual({ resumed: [], failed: [] });
    // 기한을 억지로 심어도 사유가 다르면 재개하지 않는다.
    await client.execute({
      sql: 'UPDATE subscriptions SET paused_until = ? WHERE id = ?',
      args: [Math.floor(UNTIL.getTime() / 1000), created.id],
    });
    expect(await resumeExpiredPauses(new Date('2030-01-01T00:00:00Z'))).toEqual({ resumed: [], failed: [] });
  });

  it('운영자 정지는 기한만 다시 적어 연장할 수 있다 — 결제 실패 정지는 덮어쓸 수 없다', async () => {
    const created = await pausedWithUntil();
    const later = new Date('2026-09-01T00:00:00Z');
    const extended = await pauseSubscription(created.id, { pausedUntil: later }, new Date('2026-06-01T00:00:00Z'));
    expect(extended.ok).toBe(true);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedUntil?.toISOString()).toBe(later.toISOString());

    await client.execute({
      sql: "UPDATE subscriptions SET paused_reason = 'payment_failed' WHERE id = ?",
      args: [created.id],
    });
    expect(
      await pauseSubscription(created.id, { pausedUntil: later }, new Date('2026-06-01T00:00:00Z')),
    ).toEqual({ ok: false, code: 'invalid_state' });
  });

  it('관리자 재개는 만료일을 비운다', async () => {
    const created = await pausedWithUntil();
    const resumed = await resumeSubscription(created.id, new Date('2026-04-20T00:00:00Z'));
    expect(resumed.ok).toBe(true);
    expect((await findSubscriptionById(created.id))!.pausedUntil).toBeNull();
  });

  it('해지는 만료일을 비운다 — 해지한 구독을 기한이 깨우면 안 된다', async () => {
    const created = await pausedWithUntil();
    const cancelled = await cancelSubscription(created.id, { requestedBy: 'admin', reason: 'x' }, new Date('2026-04-20T00:00:00Z'));
    expect(cancelled.ok).toBe(true);
    expect((await findSubscriptionById(created.id))!.pausedUntil).toBeNull();
    expect(await resumeExpiredPauses(new Date('2030-01-01T00:00:00Z'))).toEqual({ resumed: [], failed: [] });
  });

  it('정지 중 수동 결제가 성공하면 만료일도 비운다 — active 행에 기한이 남으면 안 된다', async () => {
    const created = await pausedWithUntil();
    chargeBillingKey.mockResolvedValue(chargeOk('pay_manual'));
    const charged = await chargeCycle(created.id, new Date('2026-05-05T00:00:00Z'), { reason: 'manual' });
    expect(charged.ok).toBe(true);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('active');
    expect(sub.pausedUntil).toBeNull();
  });

  /**
   * 운영자가 날짜를 적을 때 전제한 것("카드가 멀쩡하다")이 방금 깨진 자리다. 날짜만 남겨
   * 두면 기한이 올 때 자동 재개가 거절당한 카드를 다시 긁는다.
   */
  it('정지 중 수동 결제가 실패하면 정지는 그대로 두고 기한만 비운다', async () => {
    const created = await pausedWithUntil();
    chargeBillingKey.mockResolvedValue(chargeFail());
    await chargeCycle(created.id, new Date('2026-05-05T00:00:00Z'), { reason: 'manual' });
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.status).toBe('paused');
    expect(sub.pausedReason).toBe('operator'); // 경보 대상에서 빠지지 않는다
    expect(sub.pausedUntil).toBeNull();
    expect(await resumeExpiredPauses(new Date('2030-01-01T00:00:00Z'))).toEqual({ resumed: [], failed: [] });
  });

  it('사유를 모르는(NULL) 정지는 연장할 수 없다 — 운영자가 세운 정지가 아니다', async () => {
    const created = await pausedWithUntil();
    await client.execute({ sql: 'UPDATE subscriptions SET paused_reason = NULL WHERE id = ?', args: [created.id] });
    expect(
      await pauseSubscription(created.id, { pausedUntil: new Date('2026-09-01T00:00:00Z') }, new Date('2026-06-01T00:00:00Z')),
    ).toEqual({ ok: false, code: 'invalid_state' });
  });

  it('해지된 행에 기한이 남아 있어도 재개하지 않는다', async () => {
    const created = await pausedWithUntil();
    await client.execute({
      sql: "UPDATE subscriptions SET status = 'cancelled', paused_until = ? WHERE id = ?",
      args: [Math.floor(UNTIL.getTime() / 1000), created.id],
    });
    expect(await resumeExpiredPauses(new Date('2030-01-01T00:00:00Z'))).toEqual({ resumed: [], failed: [] });
    expect((await findSubscriptionById(created.id))!.status).toBe('cancelled');
  });

  it('재시도 대기(past_due) 구독도 기한을 받아 정지할 수 있다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue(chargeFail());
    await chargeCycle(created.id, new Date('2026-04-05T00:00:00Z'), { reason: 'scheduled' });
    expect((await findSubscriptionById(created.id))!.status).toBe('past_due');
    const paused = await pauseSubscription(created.id, { pausedUntil: UNTIL }, new Date('2026-04-06T00:00:00Z'));
    expect(paused.ok).toBe(true);
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.pausedReason).toBe('operator');
    expect(sub.pausedUntil?.toISOString()).toBe(UNTIL.toISOString());
  });
});

/**
 * 자동 재개가 **어느 날짜를 잡는가.** 여기가 틀리면 한 달치가 조용히 사라지거나
 * 예고가 하루로 줄어든다.
 */
describe('자동 재개 일정 — 예약일 보존 · 최소 예고 · 이용기간', () => {
  /** 정지 전 예약일(4/5)을 그대로 둔 채 정지만 건다. */
  const pausedBefore = async (until: Date, pausedAt = new Date('2026-04-01T00:00:00Z')) => {
    const { created } = await activated(); // billingDay 5, nextBillingAt = 2026-04-05
    const before = (await findSubscriptionById(created.id))!;
    expect(before.nextBillingAt?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    const paused = await pauseSubscription(created.id, { pausedUntil: until }, pausedAt);
    if (!paused.ok) throw new Error(`unexpected: ${paused.code}`);
    return created;
  };

  it('예약돼 있던 청구일이 아직 오지 않았으면 그 날짜를 지킨다 — 한 달을 건너뛰지 않는다', async () => {
    // 4/1에 4/2까지 정지 → 4/2 재개. 예약일 4/5는 살아 있고 최소 예고(3일)도 만족한다.
    const created = await pausedBefore(new Date('2026-04-02T00:00:00Z'));
    const result = await resumeExpiredPauses(new Date('2026-04-02T00:00:00Z'));
    expect(result.resumed[0].nextBillingAt.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    const sub = (await findSubscriptionById(created.id))!;
    expect(sub.nextBillingAt?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    // 이용기간 끝도 그대로 — 예약일을 지켰으니 어긋날 것이 없다.
    expect(sub.currentPeriodEnd?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });

  it('예약일이 최소 예고보다 가까우면 다음 정기 청구일로 민다', async () => {
    // 4/3 재개, 예약일 4/5는 이틀 뒤라 MIN_RESUME_NOTICE_DAYS(3일)에 못 미친다.
    const created = await pausedBefore(new Date('2026-04-03T00:00:00Z'));
    const resumeAt = new Date('2026-04-03T00:00:00Z');
    const result = await resumeExpiredPauses(resumeAt);
    const next = result.resumed[0].nextBillingAt;
    expect(next.toISOString()).toBe('2026-05-05T00:00:00.000Z');
    expect(next.getTime() - resumeAt.getTime()).toBeGreaterThanOrEqual(MIN_RESUME_NOTICE_DAYS * 24 * 60 * 60 * 1000);
    // 이용기간 끝을 함께 밀지 않으면 청구일은 미래인데 기간 끝은 과거인 active 행이 남고,
    // 그 상태에서 셀프 해지하면 endsAt이 과거라 그날 바로 종료된다.
    expect((await findSubscriptionById(created.id))!.currentPeriodEnd?.toISOString()).toBe('2026-05-05T00:00:00.000Z');
  });

  it('예약일이 이미 지났으면 다음 정기 청구일을 잡는다 — 밀린 달은 걷지 않는다', async () => {
    const created = await pausedBefore(UNTIL_FAR);
    const result = await resumeExpiredPauses(UNTIL_FAR);
    expect(result.resumed[0].nextBillingAt.toISOString()).toBe('2026-08-05T00:00:00.000Z');
    expect((await findSubscriptionById(created.id))!.currentPeriodEnd?.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });

  it('재개한 구독은 같은 실행의 청구 대상이 아니다', async () => {
    await pausedBefore(new Date('2026-04-03T00:00:00Z'));
    const resumeAt = new Date('2026-04-03T00:00:00Z');
    await resumeExpiredPauses(resumeAt);
    expect(await listDueSubscriptions(resumeAt)).toHaveLength(0);
  });
});

/**
 * 안내 메일은 곧 청구 예고다. 한 번 보내고 마는 구조에서는 실패하면 재시도할 길이 없어,
 * 한 달 뒤 고객이 예고 없이 청구를 맞았다.
 */
describe('자동 재개 안내 일감 — resumeNoticePendingAt', () => {
  const pausedWith = async (until: Date) => {
    const { created } = await activated();
    const paused = await pauseSubscription(created.id, { pausedUntil: until }, new Date('2026-04-01T00:00:00Z'));
    if (!paused.ok) throw new Error('unreachable');
    return created;
  };

  it('재개하면서 안내 일감을 남기고, 발송이 성공해야 지워진다', async () => {
    const created = await pausedWith(UNTIL_FAR);
    await resumeExpiredPauses(UNTIL_FAR);
    expect((await findSubscriptionById(created.id))!.resumeNoticePendingAt).not.toBeNull();

    // 발송이 실패한 날은 목록에 그대로 남는다 — 다음 cron이 다시 집는다.
    expect((await listPendingResumeNotices()).map((s) => s.id)).toEqual([created.id]);

    await clearResumeNotice(created.id, UNTIL_FAR);
    expect(await listPendingResumeNotices()).toHaveLength(0);
    expect((await findSubscriptionById(created.id))!.resumeNoticePendingAt).toBeNull();
  });

  it('다시 정지하면 안내 일감이 사라진다 — 없는 청구를 예고하지 않는다', async () => {
    const created = await pausedWith(UNTIL_FAR);
    await resumeExpiredPauses(UNTIL_FAR);
    const rePause = await pauseSubscription(created.id, { pausedUntil: new Date('2026-09-01T00:00:00Z') }, UNTIL_FAR);
    expect(rePause.ok).toBe(true);
    expect((await findSubscriptionById(created.id))!.resumeNoticePendingAt).toBeNull();
    expect(await listPendingResumeNotices()).toHaveLength(0);
  });

  it('해지하면 안내 일감이 사라진다', async () => {
    const created = await pausedWith(UNTIL_FAR);
    await resumeExpiredPauses(UNTIL_FAR);
    await cancelSubscription(created.id, { requestedBy: 'customer', reason: 'x' }, UNTIL_FAR);
    expect((await findSubscriptionById(created.id))!.resumeNoticePendingAt).toBeNull();
    expect(await listPendingResumeNotices()).toHaveLength(0);
  });
});
