/** @jest-environment node */
/**
 * 아티스트 구독의 DB 규칙 — 생성 검증, 후원자 명단, 정산 집계·기록. 실제 SQLite(in-memory).
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../data/artists', () => {
  const artists = [
    { slug: 'jai', name: '자이', supportActive: true, taxType: 'withholding' },
    { slug: 'closed', name: '닫힘', supportActive: false, taxType: 'invoice' },
  ];
  return {
    SUPPORTED_ARTISTS: artists,
    getSupportedArtist: (slug: string) => artists.find((a) => a.slug === slug) ?? null,
  };
});
jest.mock('../billing/email', () => ({ sendSubscriptionOperatorAlert: jest.fn().mockResolvedValue(null) }));
jest.mock('../billing/toss-billing', () => ({ issueBillingKey: jest.fn(), chargeBillingKey: jest.fn(), fetchPaymentByOrderId: jest.fn() }));

// eslint-disable-next-line import/first
import { createSubscription } from '../billing/service';
// eslint-disable-next-line import/first
import { buildArtistPayoutPreview, markArtistPayoutPaid, recordArtistPayout } from './payout';
// eslint-disable-next-line import/first
import { countSupporters, listPublicSupporters } from './supporters';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-05T03:00:00Z');
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
  for (const t of ['artist_payouts', 'refunds', 'payments', 'subscription_payments', 'billing_keys', 'subscriptions', 'orders']) {
    await client.execute(`DELETE FROM ${t}`);
  }
});

const base = { customerName: '김후원', customerPhone: '', customerEmail: 'fan@example.com', billingDay: 5 };

describe('createSubscription(artist-support)', () => {
  it('아티스트·등급을 저장하고 금액은 등급의 포함액에서 나눈다', async () => {
    const r = await createSubscription({ kind: 'artist-support', artistSlug: 'jai', tierId: 'standard', displayName: '팬1', displayConsent: true, ...base }, NOW);
    expect(r.ok).toBe(true);
    const row = (await client.execute("SELECT artist_slug, tier_id, display_name, display_consent, item_amount, vat_amount, total_amount, status FROM subscriptions")).rows[0];
    expect(row).toMatchObject({ artist_slug: 'jai', tier_id: 'standard', display_name: '팬1', display_consent: 1, item_amount: 9091, vat_amount: 909, total_amount: 10000, status: 'pending_card' });
  });

  it.each([
    [{ artistSlug: undefined, tierId: 'standard' }, 'artist_required'],
    [{ artistSlug: 'nobody', tierId: 'standard' }, 'artist_required'],
    [{ artistSlug: 'closed', tierId: 'standard' }, 'artist_not_open'],
    [{ artistSlug: 'jai', tierId: 'gold' }, 'invalid_tier'],
    [{ artistSlug: 'jai', tierId: undefined }, 'invalid_tier'],
  ])('%p → %s', async (over, code) => {
    const r = await createSubscription({ kind: 'artist-support', ...base, ...over }, NOW);
    expect(r).toEqual({ ok: false, code });
    expect((await client.execute('SELECT count(*) AS c FROM subscriptions')).rows[0].c).toBe(0);
  });

  it('레슨 구독은 아티스트 필드를 비워 둔다', async () => {
    const r = await createSubscription({ kind: 'lesson', ...base, displayConsent: true }, NOW);
    expect(r.ok).toBe(true);
    const row = (await client.execute('SELECT artist_slug, tier_id, display_consent FROM subscriptions')).rows[0];
    expect(row).toMatchObject({ artist_slug: null, tier_id: null, display_consent: 0 });
  });
});

const insertSub = async (id: string, status: string, consent: boolean, displayName: string | null, created: string, artist = 'jai') => {
  await client.execute({
    sql: `INSERT INTO subscriptions (id, kind, artist_slug, tier_id, customer_name, customer_phone, customer_email, customer_key,
            item_amount, vat_amount, total_amount, billing_day, status, manage_token, display_name, display_consent, created_at, updated_at)
          VALUES (?, 'artist-support', ?, 'standard', '실명', '', ?, ?, 9091, 909, 10000, 5, ?, ?, ?, ?, ?, ?)`,
    args: [id, artist, `${id}@x.y`, `ck-${id}`, status, `mt-${id}`, displayName, consent ? 1 : 0, Math.floor(new Date(created).getTime() / 1000), Math.floor(new Date(created).getTime() / 1000)],
  });
};

describe('후원자 명단', () => {
  it('동의한 사람만, 이름은 표시명, 최신순 — 해지 예정은 아직 후원자, 종료·카드 대기는 아니다', async () => {
    await insertSub('a', 'active', true, '별명A', '2026-09-01T00:00:00Z');
    await insertSub('b', 'cancelled', true, null, '2026-09-02T00:00:00Z');
    await insertSub('c', 'active', false, '비공개', '2026-09-03T00:00:00Z');
    await insertSub('d', 'ended', true, '끝남', '2026-09-04T00:00:00Z');
    await insertSub('e', 'pending_card', true, '미결제', '2026-09-05T00:00:00Z');
    await insertSub('f', 'active', true, '남의팬', '2026-09-06T00:00:00Z', 'closed');

    expect((await listPublicSupporters('jai')).map((s) => s.displayName)).toEqual(['실명', '별명A']);
    expect(await countSupporters('jai')).toBe(3);
  });
});

describe('정산', () => {
  const paidCycle = async (subId: string, orderId: string, cycleYm: string, refund = 0) => {
    await client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
            VALUES (?, ?, 'subscription', 'paid', '실명', '', 'a@b.c', ?, 9091, 909, 10000)`,
      args: [orderId, `NO-${orderId}`, `tok-${orderId}`],
    });
    await client.execute({ sql: `INSERT INTO payments (id, order_id, payment_key, method) VALUES (?, ?, ?, '카드')`, args: [`p-${orderId}`, orderId, `pk-${orderId}`] });
    await client.execute({
      sql: `INSERT INTO subscription_payments (id, subscription_id, order_id, cycle_ym, attempt, amount, status) VALUES (?, ?, ?, ?, 1, 10000, 'paid')`,
      args: [`sp-${orderId}`, subId, orderId, cycleYm],
    });
    if (refund > 0) {
      await client.execute({
        sql: `INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES (?, ?, ?, 'r', 'admin', 'done')`,
        args: [`r-${orderId}`, `p-${orderId}`, refund],
      });
    }
  };

  it('그 달 결제 회차만 합산하고 환불을 빼 스펙 §10 숫자를 낸다', async () => {
    await insertSub('a', 'active', true, null, '2026-09-01T00:00:00Z');
    await insertSub('b', 'active', true, null, '2026-09-01T00:00:00Z');
    await paidCycle('a', 'o1', '2026-09');
    await paidCycle('b', 'o2', '2026-09', 10000); // 전액 환불
    await paidCycle('a', 'o3', '2026-08'); // 다른 달

    const p = await buildArtistPayoutPreview('jai', '2026-09');
    expect(p).toMatchObject({ subscriberCount: 2, grossAmount: 20000, refundAmount: 10000, supplyAmount: 9091, shareAmount: 8182, withholdingAmount: 270, netAmount: 7912, recorded: null });
  });

  it('기록은 (아티스트, 달)당 한 번이고 지급 완료는 한 방향', async () => {
    await insertSub('a', 'active', true, null, '2026-09-01T00:00:00Z');
    await paidCycle('a', 'o1', '2026-09');

    const first = await recordArtistPayout('jai', '2026-09', NOW);
    expect(first.ok).toBe(true);
    expect(await recordArtistPayout('jai', '2026-09', NOW)).toEqual({ ok: false, code: 'already_recorded' });
    expect(await recordArtistPayout('jai', '2026-08', NOW)).toEqual({ ok: false, code: 'nothing_to_pay' });

    const id = first.ok ? first.payout.id : '';
    expect(await markArtistPayoutPaid(id, '9/10 이체', NOW)).toBe(true);
    expect(await markArtistPayoutPaid(id, null, NOW)).toBe(false);
    const row = (await client.execute('SELECT status, memo, net_amount FROM artist_payouts')).rows[0];
    expect(row).toMatchObject({ status: 'paid', memo: '9/10 이체', net_amount: 7912 });
  });

  it('없는 아티스트는 null', async () => {
    expect(await buildArtistPayoutPreview('nobody', '2026-09')).toBeNull();
  });
});
