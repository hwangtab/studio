/** @jest-environment node */

/**
 * 공연 주최자 정산 — 실제 SQLite(in-memory, 마이그레이션 전부 적용)로 고정한다. 이 표의 값이 틀리면 운영자는 틀린 금액을 이체한다.
 * 계산식(부분 환불·초대권 제외·개인/사업자·계좌 입금 결제 수수료), 회차 취소 결제 수수료 조정(멱등·면제), 음수 → 차액, 기록/지급/취소, 막는 조건을 데이터로 켠다.
 */
import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { fundingCreators, partnerPayoutAdjustments, shows, showZones, showtimes, showTicketTypes } from '../../db/schema';
import { FUNDING_PAYMENT_FEE_PERCENT } from '../../data/pricing';
import { computeFundingPayoutForProject } from '../funding/payout';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));

/* eslint-disable import/first */
import { createShowOrder } from '../shows/service';
import { confirmShowOrder } from '../shows/confirm';
import { refundShowTickets } from '../shows/refund';
import { cancelShowtime } from '../shows/showtimeOps';
import { hasPartnerInvoicePayout, hasPartnerWithheldPayout } from './creatorPayouts';
import { buildShowPayoutPreview, listShowPayoutsAwaitingRecord, recordShowPayout, lastShowEndAt } from './show';
import { computeShowtimeCancelFee, setShowtimeCancelFeeWaived, syncShowtimeCancelFee } from './showCancelFee';
import { loadShowPayoutPanel } from './showPanel';
import { deletePartnerPayoutIfPending, findPartnerPayout, markPartnerPayoutPaid } from './store';
/* eslint-enable import/first */

const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const START = sec('2026-11-01T10:00:00Z'); // 공연 길이 120분 → 12:00 종료
const AFTER = new Date('2026-11-20T03:00:00Z');
const BEFORE = new Date('2026-11-01T11:00:00Z');

let errorSpy: jest.SpyInstance;

const seedCreator = async (over: Partial<typeof fundingCreators.$inferInsert> = {}) => {
  await testDb.insert(fundingCreators).values({
    id: 'c1', email: 'c1@example.com', name: '주최자', taxType: 'withholding', payoutAccountEnc: 'enc-account', residentNumberEnc: 'enc-rrn', ...over,
  });
};

/** 공연 하나 + 회차 + (주최자 제출물). `organizer: false`면 직영 공연. */
const seedShow = async (opts: { id?: string; organizer?: boolean; termsVersion?: string | null; startsAt?: number } = {}) => {
  const { id = 's1', organizer = true, termsVersion = 'show-organizer-terms-x', startsAt = START } = opts;
  await testDb.insert(shows).values({
    id, slug: `slug-${id}`, title: `공연 ${id}`, presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 120,
    venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published',
  });
  await testDb.insert(showZones).values({ id: `z-${id}`, showId: id, code: 'A', label: 'A', capacity: 100 });
  await testDb.insert(showtimes).values({ id: `st-${id}`, showId: id, startsAt, salesCloseAt: startsAt - 3600 });
  await testDb.insert(showTicketTypes).values({ id: `tt-${id}`, showId: id, zoneId: `z-${id}`, name: '일반', price: 30000, compQuota: 5 });
  if (organizer) {
    await testDb.run(sql`INSERT INTO show_submissions (id, creator_id, show_id, draft_json, review_status, organizer_terms_version)
      VALUES (${`sub-${id}`}, 'c1', ${id}, '{}', 'approved', ${termsVersion})`);
  }
  return { showId: id, showtimeId: `st-${id}` };
};

interface PlaceOpts { showtimeId?: string; total?: number; bank?: boolean; status?: string; payment?: boolean; unit?: number; qty?: number }
/** 결제 확정된 공연 주문 한 건을 직접 만든다(토스 키 `pk-<주문번호>` 또는 계좌 입금 `bank-deposit:<주문번호>`). */
const placeOrder = async (orderNo: string, opts: PlaceOpts = {}) => {
  const { showtimeId = 'st-s1', unit = 30000, qty = 1, status = 'paid', bank = false, payment = true } = opts;
  const total = opts.total ?? unit * qty;
  await testDb.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
    VALUES (${`id-${orderNo}`}, ${orderNo}, 'ticket', ${status}, '관객', '010', 'a@b.c', ${`tok-${orderNo}`}, ${total}, 0, ${total})`);
  await testDb.run(sql`INSERT INTO show_orders (order_no, showtime_id, buyer_name, buyer_contact) VALUES (${orderNo}, ${showtimeId}, '관객', '010')`);
  for (let i = 0; i < qty; i += 1) {
    await testDb.run(sql`INSERT INTO show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, issued_by, unit_amount)
      VALUES (${`t-${orderNo}-${i}`}, ${orderNo}, ${showtimeId}, 'tt-s1', ${`code-${orderNo}-${i}`}, 'issued', 'customer', ${unit})`);
  }
  if (payment) {
    await testDb.run(sql`INSERT INTO payments (id, order_id, payment_key, method) VALUES (${`pay-${orderNo}`}, ${`id-${orderNo}`}, ${bank ? `bank-deposit:${orderNo}` : `pk-${orderNo}`}, ${bank ? 'bank' : 'card'})`);
  }
};

const compOrder = async (orderNo: string) => {
  await testDb.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
    VALUES (${`id-${orderNo}`}, ${orderNo}, 'ticket', 'paid', '초대권', '', '', ${`tok-${orderNo}`}, 0, 0, 0)`);
  await testDb.run(sql`INSERT INTO show_orders (order_no, showtime_id, buyer_name, buyer_contact) VALUES (${orderNo}, 'st-s1', '사유', 'comp')`);
  await testDb.run(sql`INSERT INTO show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, issued_by, unit_amount)
    VALUES (${`t-${orderNo}`}, ${orderNo}, 'st-s1', 'tt-s1', ${`code-${orderNo}`}, 'issued', 'organizer_comp', 0)`);
};

const refund = (orderNo: string, amount: number, reason = '고객 환불', status = 'done') =>
  testDb.run(sql`INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES (${`rf-${orderNo}-${amount}-${reason}`}, ${`pay-${orderNo}`}, ${amount}, ${reason}, 'admin', ${status})`);

const record = async (showId = 's1', now = AFTER) => {
  const p = (await buildShowPayoutPreview(showId, now))!;
  return recordShowPayout(showId, now, { netAmount: p.netAmount, adjustmentAmount: p.adjustmentAmount });
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('계산 — 판매액·환불·수수료', () => {
  it('부분 환불을 판매액에서 먼저 빼고 펀딩과 같은 식으로 수수료·원천징수를 뗀다(개인)', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1', { qty: 2, unit: 30000 }); // 60,000 토스
    await placeOrder('O2', { unit: 40000 }); // 40,000 토스
    await refund('O1', 30000); // 한 장 부분 환불
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    const expected = computeFundingPayoutForProject({ grossAmount: 100000, refundAmount: 30000, manualGrossAmount: 0, taxType: 'withholding' });
    expect(p).toMatchObject({
      settleable: true, creatorId: 'c1', taxType: 'withholding', itemCount: 3, grossAmount: 100000, refundAmount: 30000, netSalesAmount: 70000,
      platformFeeAmount: expected.platformFeeAmount, paymentFeeAmount: expected.paymentFeeAmount, vatDeductionAmount: expected.vatDeductionAmount,
      shareAmount: expected.shareAmount, withholdingAmount: expected.withholdingAmount, netAmount: expected.netAmount,
      adjustmentAmount: 0, shortfallAmount: 0, blockers: [],
    });
    // 수수료 반올림: 70,000 × 5.5% = 3,850 / × 3.3% = 2,310
    expect(p.platformFeeAmount).toBe(3850);
    expect(p.paymentFeeAmount).toBe(2310);
    // 불변식: 몫 + 부가세 상당 + 수수료 = 순판매액
    expect(p.shareAmount + p.vatDeductionAmount + p.platformFeeAmount + p.paymentFeeAmount).toBe(70000);
  });

  it('초대권(0원·결제 없음)과 결제 확정 전 주문은 판매액에 들어가지 않는다', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    await compOrder('C1');
    await placeOrder('PEND', { status: 'awaiting_deposit', payment: false });
    await placeOrder('EXP', { status: 'expired', payment: false });
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p).toMatchObject({ grossAmount: 30000, itemCount: 1 });
  });

  it('사업자는 부가세 상당액·원천징수가 없다', async () => {
    await seedCreator({ taxType: 'invoice' });
    await testDb.run(sql`INSERT INTO creator_business_profiles (creator_id, business_number, business_name, representative_name) VALUES ('c1', '7537400653', '상호', '대표')`);
    await seedShow();
    await placeOrder('O1', { unit: 100000 });
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p).toMatchObject({ taxType: 'invoice', vatDeductionAmount: 0, withholdingAmount: 0, blockers: [] });
    expect(p.netAmount).toBe(100000 - 5500 - 3300);
  });

  it('계좌 입금 몫에는 결제 수수료를 매기지 않는다(토스를 지나지 않은 돈) — 환불된 계좌 입금은 그만큼 뺀다', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('T1', { unit: 50000 });
    await placeOrder('B1', { unit: 50000, bank: true });
    await refund('B1', 20000);
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    // 순판매액 80,000, 계좌 입금 순몫 30,000 → 결제 수수료 과세표준 50,000
    expect(p).toMatchObject({ grossAmount: 100000, refundAmount: 20000, platformFeeAmount: 4400, paymentFeeAmount: 1650 });
  });

  it('환불이 판매액을 다 덮으면 정산할 것이 없다(nothing_to_pay)', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    await refund('O1', 30000);
    await testDb.run(sql`UPDATE orders SET status = 'refunded' WHERE order_no = 'O1'`);
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p).toMatchObject({ grossAmount: 30000, refundAmount: 30000, netAmount: 0 });
    expect(p.blockers).toContain('nothing_to_pay');
    expect(await record()).toMatchObject({ ok: false, code: 'nothing_to_pay' });
  });

  it('실패한 환불(status failed)은 세지 않는다', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    await refund('O1', 30000, '실패', 'failed');
    expect((await buildShowPayoutPreview('s1', AFTER))!.refundAmount).toBe(0);
  });
});

describe('기록 시점·직영 공연', () => {
  it('마지막 회차가 끝나기 전에는 not_ended로 막고, 끝난 뒤에는 기록된다', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    const before = (await buildShowPayoutPreview('s1', BEFORE))!;
    expect(before.ended).toBe(false);
    expect(before.blockers).toContain('not_ended');
    expect(await recordShowPayout('s1', BEFORE, { netAmount: before.netAmount, adjustmentAmount: 0 })).toMatchObject({ ok: false, code: 'not_ended' });
    expect(await findPartnerPayout('show', 's1', 'all')).toBeNull();
    expect(await record('s1', AFTER)).toMatchObject({ ok: true });
  });

  it('마지막 회차 기준: 회차 둘이면 늦은 쪽의 시작 + 공연 길이, 취소된 회차는 건너뛴다', () => {
    expect(lastShowEndAt([
      { startsAt: 1000, status: 'scheduled', cancelledAt: null }, { startsAt: 5000, status: 'cancelled', cancelledAt: 100 }, { startsAt: 3000, status: 'ended', cancelledAt: null },
    ], 10)).toBe(3000 + 600);
    expect(lastShowEndAt([{ startsAt: 1000, status: 'cancelled', cancelledAt: 4000 }], 10)).toBe(4000);
    expect(lastShowEndAt([], 10)).toBeNull();
  });

  it('주최자가 없는 직영 공연은 정산 대상 아님 — 기록도 거절', async () => {
    await seedCreator();
    await seedShow({ organizer: false });
    await placeOrder('O1');
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p).toMatchObject({ settleable: false, notSettleableReason: 'studio_direct', netAmount: 0 });
    expect(await recordShowPayout('s1', AFTER, { netAmount: 0, adjustmentAmount: 0 })).toMatchObject({ ok: false, code: 'not_settleable' });
    expect((await loadShowPayoutPanel('s1', AFTER))).toMatchObject({ state: 'ok', view: { settleable: false, notSettleableReason: 'studio_direct' } });
    expect(await buildShowPayoutPreview('nope', AFTER)).toBeNull();
  });

  it('제출물이 승인 전이면 주최자가 없는 것으로 본다', async () => {
    await seedCreator();
    await seedShow();
    await testDb.run(sql`UPDATE show_submissions SET review_status = 'submitted'`);
    expect((await buildShowPayoutPreview('s1', AFTER))!.settleable).toBe(false);
  });
});

describe('막는 조건·경고', () => {
  it('세금 구분·계좌·약관·사업자 정보 — 각각 막는다', async () => {
    await seedCreator({ taxType: null, payoutAccountEnc: null });
    await seedShow({ termsVersion: null });
    await placeOrder('O1');
    let p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p.blockers).toEqual(expect.arrayContaining(['no_tax_type', 'no_payout_account', 'terms_not_agreed']));
    expect(await record()).toMatchObject({ ok: false });
    expect(await findPartnerPayout('show', 's1', 'all')).toBeNull();

    await testDb.update(fundingCreators).set({ taxType: 'invoice', payoutAccountEnc: 'enc' }).where(eq(fundingCreators.id, 'c1'));
    await testDb.run(sql`UPDATE show_submissions SET organizer_terms_version = 'v'`);
    p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p.blockers).toEqual(['no_business_number']);
  });

  it('주민등록번호 미등록은 막지 않고 경고만 한다', async () => {
    await seedCreator({ residentNumberEnc: null });
    await seedShow();
    await placeOrder('O1');
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p.blockers).toEqual([]);
    expect(p.warnings).toContain('no_resident_number');
    expect(await record()).toMatchObject({ ok: true });
  });

  it('환불 계좌 접수 후 송금 전 / 취소 회차에 환불이 안 끝난 주문 — 경고', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('B1', { bank: true });
    await refund('B1', 30000);
    await testDb.run(sql`INSERT INTO refund_accounts (id, order_kind, order_no, bank_name, account_number_enc, account_holder, requested_at) VALUES ('ra1', 'show', 'B1', '은행', 'enc', '관객', 1)`);
    let p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p.warnings).toContain('refund_account_pending');
    expect(p.refundAccountPendingCount).toBe(1);

    await testDb.run(sql`UPDATE refund_accounts SET refunded_at = 2`);
    await testDb.run(sql`UPDATE show_tickets SET status = 'refunded' WHERE order_no = 'B1'`);
    await testDb.run(sql`UPDATE orders SET status = 'refunded' WHERE order_no = 'B1'`);
    await placeOrder('B2', { bank: true });
    await testDb.run(sql`UPDATE showtimes SET status = 'cancelled', cancelled_at = ${START - 100}`);
    p = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(p.warnings).not.toContain('refund_account_pending');
    expect(p.warnings).toContain('refund_due_cancelled');
    expect(p.refundDueCancelledOrderCount).toBe(1);
  });
});

describe('기록 — 불변 스냅샷·이중 기록·지급·취소', () => {
  it('기록하면 숫자가 고정된다(creator_id·period all 포함). 이후 판매가 늘어도 기록은 그대로, drift로 보인다', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1', { unit: 100000 });
    const result = await record();
    expect(result.ok).toBe(true);
    const before = (await findPartnerPayout('show', 's1', 'all'))!;
    const calc = computeFundingPayoutForProject({ grossAmount: 100000, refundAmount: 0, manualGrossAmount: 0, taxType: 'withholding' });
    expect(before).toMatchObject({
      kind: 'show', subjectKey: 's1', period: 'all', creatorId: 'c1', payeeName: '주최자', taxType: 'withholding',
      grossAmount: 100000, refundAmount: 0, platformFeeAmount: 5500, paymentFeeAmount: 3300, shippingAmount: 0, studioAmount: 0,
      vatDeductionAmount: calc.vatDeductionAmount, shareAmount: calc.shareAmount, withholdingAmount: calc.withholdingAmount,
      netAmount: calc.netAmount, itemCount: 1, status: 'pending', adjustmentAmount: 0, shortfallAmount: 0,
    });
    await placeOrder('O2', { unit: 30000 });
    await testDb.update(fundingCreators).set({ taxType: 'invoice', name: '바뀐 이름' }).where(eq(fundingCreators.id, 'c1'));
    expect(await findPartnerPayout('show', 's1', 'all')).toEqual(before);
    const preview = (await buildShowPayoutPreview('s1', AFTER))!;
    expect(preview.blockers).toContain('already_recorded');
    expect(preview.recorded?.grossAmount).toBe(100000);
    expect(preview.grossAmount).toBe(130000);
  });

  it('두 번 기록하면 already_recorded — 동시에 눌러도 한 건만', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    const expected = { netAmount: p.netAmount, adjustmentAmount: 0 };
    const results = await Promise.all([recordShowPayout('s1', AFTER, expected), recordShowPayout('s1', AFTER, expected)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)[0]).toMatchObject({ ok: false, code: 'already_recorded' });
    expect(await testDb.run(sql`SELECT 1 FROM partner_payouts WHERE kind = 'show'`).then((r) => r.rows.length)).toBe(1);
  });

  it('화면이 본 금액과 지금 계산이 다르면 amount_changed', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    expect(await recordShowPayout('s1', AFTER, { netAmount: 1, adjustmentAmount: 0 })).toMatchObject({ ok: false, code: 'amount_changed', expectedNetAmount: 1 });
    expect(await findPartnerPayout('show', 's1', 'all')).toBeNull();
  });

  it('지급 완료는 한 번만 되고 지급한 기록은 지울 수 없다. 이체 전 기록은 지우고 다시 기록할 수 있다', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    await record();
    const row = (await findPartnerPayout('show', 's1', 'all'))!;
    expect(await deletePartnerPayoutIfPending(row.id)).toBe('ok');
    expect(await findPartnerPayout('show', 's1', 'all')).toBeNull();
    expect(await record()).toMatchObject({ ok: true });
    const again = (await findPartnerPayout('show', 's1', 'all'))!;
    expect(await markPartnerPayoutPaid(again.id, '11/20 이체', AFTER)).toBe(true);
    expect(await markPartnerPayoutPaid(again.id, null, AFTER)).toBe(false);
    expect(await deletePartnerPayoutIfPending(again.id)).toBe('already_paid');
  });

  it('보존·파기 코드가 공연 정산을 본다 — 원천징수 기록은 hasPartnerWithheldPayout, 사업자 기록은 hasPartnerInvoicePayout', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1', { unit: 100000 });
    expect(await hasPartnerWithheldPayout('c1')).toBe(false);
    await record();
    expect(await hasPartnerWithheldPayout('c1')).toBe(true);
    expect(await hasPartnerInvoicePayout('c1')).toBe(false);

    await testDb.run(sql`DELETE FROM partner_payouts`);
    await testDb.update(fundingCreators).set({ taxType: 'invoice' }).where(eq(fundingCreators.id, 'c1'));
    await testDb.run(sql`INSERT INTO creator_business_profiles (creator_id, business_number, business_name, representative_name) VALUES ('c1', '7537400653', '상호', '대표')`);
    await record();
    expect(await hasPartnerInvoicePayout('c1')).toBe(true);
    expect(await hasPartnerWithheldPayout('c1')).toBe(false);
  });
});

describe('회차 취소 결제 수수료 조정', () => {
  /** 실제 주문·결제·취소 경로로 만든다 — 훅이 cancelShowtime 끝에서 조정을 만든다. */
  const seedAndCancel = async () => {
    await seedCreator();
    await testDb.insert(shows).values({ id: 'show-1', slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
    await testDb.insert(showZones).values({ id: 'zone-1', showId: 'show-1', code: 'A', label: 'A', capacity: 10 });
    const startsAt = Math.floor(Date.now() / 1000) + 86400 * 15;
    await testDb.insert(showtimes).values({ id: 'showtime-1', showId: 'show-1', startsAt, salesCloseAt: startsAt - 86400 });
    await testDb.insert(showTicketTypes).values({ id: 'type-1', showId: 'show-1', zoneId: 'zone-1', name: '일반', price: 10000 });
    await testDb.run(sql`INSERT INTO show_submissions (id, creator_id, show_id, draft_json, review_status, organizer_terms_version) VALUES ('sub1', 'c1', 'show-1', '{}', 'approved', 'v')`);
    const created = await createShowOrder({ showtimeId: 'showtime-1', ticketTypeId: 'type-1', quantity: 3, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 30000 }, { trustedByWebhook: false }, toss);
    return { toss, orderNo: created.orderNo };
  };
  const NOW_AFTER_CANCEL = () => new Date(Date.now() + 86400 * 1000);

  it('회차를 취소하면 환불한 토스 결제분의 결제 수수료가 주최자에게 음수 조정으로 쌓인다(회차당 한 건, 다시 불러도 그대로)', async () => {
    const { toss } = await seedAndCancel();
    await cancelShowtime('showtime-1', new Date(), toss);
    const fee = Math.round((30000 * FUNDING_PAYMENT_FEE_PERCENT) / 100);
    const rows = await testDb.select().from(partnerPayoutAdjustments);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'show', payeeKey: 'creator:c1', amount: -fee, reason: 'showtime_cancel_fee', sourceRef: 'showtime-1', appliedPayoutId: null });
    // 이어서 처리로 다시 불려도(멱등) 한 건이다.
    await cancelShowtime('showtime-1', new Date(), toss);
    expect(await syncShowtimeCancelFee('showtime-1')).toBe('exists');
    expect(await testDb.select().from(partnerPayoutAdjustments)).toHaveLength(1);

    // 정산: 판매 30,000 − 전액 환불 → 순판매 0. 조정만 있어 정산금이 모자라 차액(청구)이 된다.
    const p = (await buildShowPayoutPreview('show-1', NOW_AFTER_CANCEL()))!;
    expect(p).toMatchObject({
      grossAmount: 30000, refundAmount: 30000, netSalesAmount: 0, adjustmentAmount: -fee, adjustmentOffsetAmount: 0, shortfallAmount: fee, netAmount: 0,
      cancelFees: [{ showtimeId: 'showtime-1', amount: fee, waived: false, applied: false }],
    });
    expect(p.blockers).toEqual([]);
    expect(await computeShowtimeCancelFee('showtime-1')).toBe(fee);
  });

  it('정산금이 모자라면 정산금은 0원이고 모자라는 만큼은 shortfall_amount에 남는다(이월하지 않는다)', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1', { unit: 10000 });
    await placeOrder('O2', { unit: 10000 });
    // 다른 회차(같은 공연)가 취소되며 환불된 결제 — 가짜 토스 환불 행으로 직접 만든다.
    await testDb.insert(showtimes).values({ id: 'st-cancel', showId: 's1', startsAt: START, salesCloseAt: START - 3600, status: 'cancelled', cancelledAt: START - 7200 });
    await testDb.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
      VALUES ('id-OC', 'OC', 'ticket', 'refunded', 'x', '010', 'a@b.c', 'tok-OC', 1, 0, 1000000)`);
    await testDb.run(sql`INSERT INTO show_orders (order_no, showtime_id, buyer_name, buyer_contact) VALUES ('OC', 'st-cancel', 'x', '010')`);
    await testDb.run(sql`INSERT INTO payments (id, order_id, payment_key, method) VALUES ('pay-OC', 'id-OC', 'pk-OC', 'card')`);
    await testDb.run(sql`INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES ('rf-OC', 'pay-OC', 1000000, '공연 회차 취소 환불', 'admin', 'done')`);
    // 이 주문의 판매·환불은 서로 상쇄 → 순판매액은 O1+O2 = 20,000, 조정은 1,000,000 × 3.3% = 33,000
    expect(await syncShowtimeCancelFee('st-cancel')).toBe('inserted');
    const p = (await buildShowPayoutPreview('s1', AFTER))!;
    const base = computeFundingPayoutForProject({ grossAmount: 1020000, refundAmount: 1000000, manualGrossAmount: 0, taxType: 'withholding' });
    expect(p.adjustmentAmount).toBe(-33000);
    // 원천징수까지 뺀 금액(= 정산 가능액)에서 33,000을 빼면 모자란다
    const room = base.shareAmount - base.withholdingAmount;
    expect(room).toBeLessThan(33000);
    expect(p).toMatchObject({ adjustmentOffsetAmount: room, shortfallAmount: 33000 - room, netAmount: 0 });

    expect(await record()).toMatchObject({ ok: true });
    const row = (await findPartnerPayout('show', 's1', 'all'))!;
    expect(row).toMatchObject({ netAmount: 0, adjustmentAmount: -33000, shortfallAmount: 33000 - room });
    // 조정은 이 기록에 실렸다
    expect((await testDb.select().from(partnerPayoutAdjustments))[0].appliedPayoutId).toBe(row.id);
  });

  it('스튜디오 귀책 면제 — 상쇄 조정이 쌓이고 되돌릴 수 있다. 정산에 실린 뒤에는 바꿀 수 없다', async () => {
    const { toss } = await seedAndCancel();
    await cancelShowtime('showtime-1', new Date(), toss);
    const fee = 990;
    expect(await setShowtimeCancelFeeWaived('show-1', 'showtime-1', true)).toBe('ok');
    expect(await setShowtimeCancelFeeWaived('show-1', 'showtime-1', true)).toBe('unchanged');
    let p = (await buildShowPayoutPreview('show-1', NOW_AFTER_CANCEL()))!;
    expect(p).toMatchObject({ adjustmentAmount: 0, shortfallAmount: 0, cancelFees: [{ showtimeId: 'showtime-1', amount: fee, waived: true }] });
    const manual = (await testDb.select().from(partnerPayoutAdjustments)).filter((a) => a.reason === 'manual');
    expect(manual).toMatchObject([{ amount: fee, sourceRef: 'waive:showtime-1' }]);

    expect(await setShowtimeCancelFeeWaived('show-1', 'showtime-1', false)).toBe('ok');
    p = (await buildShowPayoutPreview('show-1', NOW_AFTER_CANCEL()))!;
    expect(p).toMatchObject({ adjustmentAmount: -fee, cancelFees: [{ waived: false }] });

    // 다른 공연의 회차·없는 회차는 거절
    expect(await setShowtimeCancelFeeWaived('other', 'showtime-1', true)).toBe('not_found');

    // 기록하면 조정이 실린다 → 면제 변경 불가. 이체 전 기록을 취소하면 다시 바꿀 수 있다.
    expect(await record('show-1', NOW_AFTER_CANCEL())).toMatchObject({ ok: true });
    expect(await setShowtimeCancelFeeWaived('show-1', 'showtime-1', true)).toBe('already_applied');
    const row = (await findPartnerPayout('show', 'show-1', 'all'))!;
    expect(await deletePartnerPayoutIfPending(row.id)).toBe('ok');
    expect((await testDb.select().from(partnerPayoutAdjustments)).every((a) => a.appliedPayoutId === null)).toBe(true);
    expect(await setShowtimeCancelFeeWaived('show-1', 'showtime-1', true)).toBe('ok');
  });

  it('직영 공연의 회차 취소는 조정을 만들지 않고, 조정 생성 실패(표 없음)는 회차 취소를 막지 않는다', async () => {
    const { toss } = await seedAndCancel();
    await testDb.run(sql`DELETE FROM show_submissions`);
    await cancelShowtime('showtime-1', new Date(), toss);
    expect(await testDb.select().from(partnerPayoutAdjustments)).toHaveLength(0);

    // 표(0067)가 없는 DB — 취소는 정상 종료
    const second = await seedAndCancelOn();
    await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
    await expect(cancelShowtime(second.showtimeId, new Date(), second.toss)).resolves.toBeDefined();
  });

  /** 위 테스트에서 DB를 새로 만들고 같은 공연을 다시 시드한다. */
  async function seedAndCancelOn() {
    testDb = (await createTestDb()).db;
    const r = await seedAndCancel();
    return { toss: r.toss, showtimeId: 'showtime-1' };
  }

  it('같은 공연의 조정만 싣는다 — 같은 주최자의 다른 공연 회차 조정은 그 공연 정산에 간다', async () => {
    await seedCreator();
    await seedShow({ id: 's1' });
    await seedShow({ id: 's2' });
    await placeOrder('O1');
    await testDb.insert(partnerPayoutAdjustments).values({ kind: 'show', payeeKey: 'creator:c1', amount: -500, reason: 'showtime_cancel_fee', sourceRef: 'st-s2' });
    const p1 = (await buildShowPayoutPreview('s1', AFTER))!;
    const p2 = (await buildShowPayoutPreview('s2', AFTER))!;
    expect(p1.adjustmentAmount).toBe(0);
    expect(p2.adjustmentAmount).toBe(-500);
    await record('s1');
    expect((await testDb.select().from(partnerPayoutAdjustments))[0].appliedPayoutId).toBeNull();
  });
});

describe('부분 환불 경로와의 일관 — refundShowTickets의 기록이 그대로 환불액이 된다', () => {
  it('토스 부분 환불(실제 경로) 뒤 정산 환불액 = 환불 행 합', async () => {
    await seedCreator();
    await testDb.insert(shows).values({ id: 'show-1', slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
    await testDb.insert(showZones).values({ id: 'zone-1', showId: 'show-1', code: 'A', label: 'A', capacity: 10 });
    const startsAt = Math.floor(Date.now() / 1000) + 86400 * 15;
    await testDb.insert(showtimes).values({ id: 'showtime-1', showId: 'show-1', startsAt, salesCloseAt: startsAt - 86400 });
    await testDb.insert(showTicketTypes).values({ id: 'type-1', showId: 'show-1', zoneId: 'zone-1', name: '일반', price: 10000 });
    await testDb.run(sql`INSERT INTO show_submissions (id, creator_id, show_id, draft_json, review_status, organizer_terms_version) VALUES ('sub1', 'c1', 'show-1', '{}', 'approved', 'v')`);
    const created = await createShowOrder({ showtimeId: 'showtime-1', ticketTypeId: 'type-1', quantity: 2, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 20000 }, { trustedByWebhook: false }, toss);
    const tickets = await testDb.query.showTickets.findMany({ where: (t, { eq: is }) => is(t.orderNo, created.orderNo) });
    const r = await refundShowTickets({ orderNo: created.orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(r.status).toBe('refunded');
    const done = await testDb.all<{ n: number }>(sql`SELECT COALESCE(SUM(amount), 0) AS n FROM refunds WHERE status = 'done'`);
    const p = (await buildShowPayoutPreview('show-1', new Date(startsAt * 1000 + 86400 * 1000)))!;
    expect(p.grossAmount).toBe(20000);
    expect(p.refundAmount).toBe(Number(done[0].n));
    expect(p.refundAmount).toBeGreaterThan(0);
  });
});

describe('대기열 — 마지막 회차 종료 + 정산 대상 + 미기록', () => {
  it('끝났고 판매가 있고 기록이 없는 주최자 공연만 센다. 기록하면 빠진다', async () => {
    await seedCreator();
    await seedShow({ id: 's1' }); // 주최자·판매·종료
    await seedShow({ id: 's2', organizer: false }); // 직영
    await seedShow({ id: 's3' }); // 판매 없음
    await seedShow({ id: 's4', startsAt: sec('2026-12-01T10:00:00Z') }); // 아직 안 끝남
    await placeOrder('O1');
    await placeOrder('O2', { showtimeId: 'st-s2' });
    await placeOrder('O4', { showtimeId: 'st-s4' });
    const list = await listShowPayoutsAwaitingRecord(AFTER);
    expect(list.map((s) => s.id)).toEqual(['s1']);
    expect(list[0].endAt.toISOString()).toBe(new Date((START + 7200) * 1000).toISOString());
    await record('s1');
    expect(await listShowPayoutsAwaitingRecord(AFTER)).toEqual([]);
  });

  it('표(0067)가 없으면 던진다 — 호출부가 삼킨다', async () => {
    await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
    await testDb.run(sql`DROP TABLE partner_payouts`);
    await expect(listShowPayoutsAwaitingRecord(AFTER)).rejects.toBeDefined();
  });
});

describe('정산 절 데이터 — 표가 없으면 그 절만 안내', () => {
  it('표(0067)가 없으면 migration, 있으면 ok', async () => {
    await seedCreator();
    await seedShow();
    await placeOrder('O1');
    expect(await loadShowPayoutPanel('s1', AFTER)).toMatchObject({ state: 'ok' });
    await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
    await testDb.run(sql`DROP TABLE partner_payouts`);
    expect(await loadShowPayoutPanel('s1', AFTER)).toEqual({ state: 'migration' });
  });
});
