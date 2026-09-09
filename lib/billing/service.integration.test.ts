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

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

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
  pauseSubscription,
  reconcileSubscriptionPaymentFromToss,
  resumeSubscription,
} from './service';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-03-05T00:00:00Z');

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
const orderNoForCycle = async (subscriptionId: string, cycleYm: string): Promise<string> => {
  const row = await mockDb.query.subscriptionPayments.findFirst({
    where: (t, { and: is, eq: eq_ }) => is(eq_(t.subscriptionId, subscriptionId), eq_(t.cycleYm, cycleYm)),
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
    expect(sub.totalAmount).toBe(385000);
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
      payment: { paymentKey: 'pay_recovered', orderId: orderNo, status: 'DONE', totalAmount: 385000 },
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
      payment: { paymentKey: 'pay_never', orderId: orderNo, status: 'EXPIRED', totalAmount: 385000 },
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
    expect((await pauseSubscription(created.id, NOW)).ok).toBe(true);
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
      { paymentKey: 'pay_recovered', orderId: orderNo, status: 'DONE', totalAmount: 385000 },
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

  it('이미 paid로 반영된 주문은 다시 건드리지 않는다 (멱등)', async () => {
    const { created } = await activated();
    const orderNo = await orderNoOf(created.id, '2026-03');
    // activated()의 첫 결제는 이미 paid — 재도착 웹훅이 다시 와도 no-op이어야 한다.
    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_1', orderId: orderNo, status: 'DONE', totalAmount: 385000 },
      NOW,
    );
    const sub = (await findSubscriptionById(created.id))!;
    // nextBillingAt이 그대로다 — 다시 반영했다면 5월로 또 전진했을 것이다.
    expect(sub.nextBillingAt?.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });

  it('CANCELED 등 DONE이 아닌 상태는 무시한다', async () => {
    const { created } = await activated();
    chargeBillingKey.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    const april = new Date('2026-04-05T00:00:00Z');
    await chargeCycle(created.id, april, { reason: 'scheduled' });
    const orderNo = await orderNoOf(created.id, '2026-04');

    await reconcileSubscriptionPaymentFromToss(
      { paymentKey: 'pay_x', orderId: orderNo, status: 'CANCELED', totalAmount: 385000 },
      april,
    );
    const rows = await client.execute('SELECT status FROM orders ORDER BY created_at');
    expect(rows.rows.map((r) => r.status)).toContain('pending'); // 손대지 않았다
  });
});
