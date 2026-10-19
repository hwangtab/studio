import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { availabilityBlocks, paymentLinks } from '../../db/schema';
import { PAYMENT_LINKS } from '../../data/paymentLinks';

let testDb: ShowsTestDb;
let brokenDb = false;
jest.mock('../../db/client', () => ({
  getDb: () => {
    if (brokenDb) throw new Error('no such table: payment_links');
    return testDb;
  },
}));

/* eslint-disable import/first */
import {
  PAYMENT_LINK_LIMITS, closePaymentLink, createPaymentLink, findPaymentLink, listPaymentLinks, validatePaymentLinkInput,
} from './paymentLinks';
import { parseKstSessionAt } from './paymentLinkRules';
/* eslint-enable import/first */

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  brokenDb = false;
});

const now = new Date('2026-10-15T03:00:00Z'); // KST 12:00 10/15

describe('validatePaymentLinkInput', () => {
  const ok = { itemName: ' 보컬 녹음 3시간 ', totalAmount: 250000, expiresOn: '2026-10-17', memo: ' 김준호님 ' };

  it('이름·메모는 다듬고 금액은 부가세 포함 정수로 받는다', () => {
    expect(validatePaymentLinkInput(ok, now)).toEqual({ ok: true, value: { itemName: '보컬 녹음 3시간', totalAmount: 250000, expiresOn: '2026-10-17', memo: '김준호님', sessionAt: null, sessionHours: null, blockSlot: false } });
    expect(validatePaymentLinkInput({ ...ok, totalAmount: '250000', expiresOn: '', memo: '' }, now)).toMatchObject({ ok: true, value: { totalAmount: 250000, expiresOn: null, memo: null, sessionAt: null, sessionHours: null, blockSlot: false } });
  });

  it.each([
    ['빈 이름', { ...ok, itemName: ' ' }],
    ['긴 이름', { ...ok, itemName: 'a'.repeat(PAYMENT_LINK_LIMITS.itemNameMax + 1) }],
    ['소수 금액', { ...ok, totalAmount: 250000.5 }],
    ['너무 작은 금액(자릿수 실수)', { ...ok, totalAmount: 250 }],
    ['너무 큰 금액', { ...ok, totalAmount: PAYMENT_LINK_LIMITS.maxAmount + 1 }],
    ['글자 금액', { ...ok, totalAmount: '이십오만' }],
    ['없는 날짜', { ...ok, expiresOn: '2026-02-30' }],
    ['형식이 다른 날짜', { ...ok, expiresOn: '10/17' }],
    ['지난 만료일', { ...ok, expiresOn: '2026-10-14' }],
    ['긴 메모', { ...ok, memo: 'm'.repeat(PAYMENT_LINK_LIMITS.memoMax + 1) }],
  ])('거절: %s', (_name, body) => {
    expect(validatePaymentLinkInput(body, now).ok).toBe(false);
  });

  it('오늘이 만료일이어도 받는다(그날 끝까지 열린다)', () => {
    expect(validatePaymentLinkInput({ ...ok, expiresOn: '2026-10-15' }, now).ok).toBe(true);
  });
});

describe('이용 일시 입력 검증', () => {
  const base = { itemName: 'x', totalAmount: 250000 };
  it('한국시간으로 읽는다 — 10/17 11:00 KST = 02:00Z', () => {
    expect(parseKstSessionAt('2026-10-17 11:00')).toBe(Math.floor(new Date('2026-10-17T02:00:00Z').getTime() / 1000));
    expect(parseKstSessionAt('2026-10-17T11:00')).toBe(parseKstSessionAt('2026-10-17 11:00'));
    expect(parseKstSessionAt('2026-10-17 25:00')).toBeNull();
    expect(parseKstSessionAt('2026-02-30 10:00')).toBeNull();
    expect(parseKstSessionAt('10/17 11시')).toBeNull();
  });
  it('일시+시간이 있으면 기본으로 슬롯을 막는다, 끄면 안 막는다', () => {
    expect(validatePaymentLinkInput({ ...base, sessionAt: '2026-10-17 11:00', sessionHours: 3 }, now)).toMatchObject({ ok: true, value: { sessionHours: 3, blockSlot: true } });
    expect(validatePaymentLinkInput({ ...base, sessionAt: '2026-10-17 11:00', sessionHours: '3', blockSlot: false }, now)).toMatchObject({ ok: true, value: { blockSlot: false } });
    expect(validatePaymentLinkInput(base, now)).toMatchObject({ ok: true, value: { sessionAt: null, sessionHours: null, blockSlot: false } });
  });
  it.each([
    ['지난 일시', { sessionAt: '2026-10-14 11:00', sessionHours: 3 }],
    ['시간 없음', { sessionAt: '2026-10-17 11:00' }],
    ['0시간', { sessionAt: '2026-10-17 11:00', sessionHours: 0 }],
    ['13시간', { sessionAt: '2026-10-17 11:00', sessionHours: 13 }],
    ['일시 없이 시간만', { sessionHours: 3 }],
    ['형식 오류', { sessionAt: '내일 11시', sessionHours: 3 }],
  ])('거절: %s', (_n, extra) => {
    expect(validatePaymentLinkInput({ ...base, ...extra }, now).ok).toBe(false);
  });
});

describe('발급·조회·닫기', () => {
  it('만든 링크는 바로 열린다 — slug는 24자리 hex, 금액·이름은 저장한 값 그대로', async () => {
    const { slug } = await createPaymentLink({ itemName: '보컬 녹음 3시간', totalAmount: 250000, expiresOn: null, memo: null, sessionAt: null, sessionHours: null, blockSlot: false });
    expect(slug).toMatch(/^[0-9a-f]{24}$/);
    expect(await findPaymentLink(slug, now)).toEqual({ itemName: '보컬 녹음 3시간', totalAmount: 250000 });
  });

  it('만료일 당일 끝까지 열리고 다음 날부터 닫힌다(KST)', async () => {
    const { slug } = await createPaymentLink({ itemName: 'x', totalAmount: 10000, expiresOn: '2026-10-17', memo: null, sessionAt: null, sessionHours: null, blockSlot: false });
    expect(await findPaymentLink(slug, new Date('2026-10-17T14:59:00Z'))).not.toBeNull(); // KST 10/17 23:59
    expect(await findPaymentLink(slug, new Date('2026-10-17T15:00:00Z'))).toBeNull(); // KST 10/18 00:00
  });

  it('닫으면 열리지 않고, 다시 닫기는 false — 닫은 시각을 덮지 않는다', async () => {
    const { slug } = await createPaymentLink({ itemName: 'x', totalAmount: 10000, expiresOn: null, memo: null, sessionAt: null, sessionHours: null, blockSlot: false });
    expect((await closePaymentLink(slug, now)).closed).toBe(true);
    expect(await findPaymentLink(slug, now)).toBeNull();
    expect((await closePaymentLink(slug, new Date('2026-10-16T00:00:00Z'))).closed).toBe(false);
    const row = await testDb.query.paymentLinks.findFirst();
    expect(row!.closedAt).toBe(Math.floor(now.getTime() / 1000));
  });

  it('없는 slug·형식이 틀린 slug는 null', async () => {
    expect(await findPaymentLink('0'.repeat(24), now)).toBeNull();
    expect(await findPaymentLink('../x', now)).toBeNull();
    expect(await findPaymentLink(undefined, now)).toBeNull();
    expect((await closePaymentLink('nope', now)).closed).toBe(false);
  });

  it('목록은 최신순이고 열림 여부를 계산해 준다', async () => {
    await testDb.insert(paymentLinks).values([
      { slug: 'a'.repeat(24), itemName: '옛', totalAmount: 10000, expiresOn: '2026-10-01', createdAt: 100 },
      { slug: 'b'.repeat(24), itemName: '새', totalAmount: 20000, memo: '메모', createdAt: 200 },
    ]);
    const rows = await listPaymentLinks(10, now);
    expect(rows.map((r) => [r.itemName, r.open])).toEqual([['새', true], ['옛', false]]);
  });
});

describe('옛 파일 링크와의 호환', () => {
  const fileSlug = Object.keys(PAYMENT_LINKS)[0];

  it('DB에 없으면 파일 링크가 그대로 열린다', async () => {
    expect(await findPaymentLink(fileSlug, now)).toMatchObject({ itemName: PAYMENT_LINKS[fileSlug].itemName });
  });

  it('표가 없는 DB(마이그레이션 전)에서도 파일 링크는 열린다 — DB 조회 실패를 삼킨다', async () => {
    brokenDb = true;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await findPaymentLink(fileSlug, now)).not.toBeNull();
    expect(await findPaymentLink('c'.repeat(24), now)).toBeNull();
    spy.mockRestore();
  });
});

describe('이용 일시·슬롯 차단(0062)', () => {
  const sessionAt = Math.floor(new Date('2026-10-17T02:00:00Z').getTime() / 1000); // KST 10/17 11:00
  const withSession = { itemName: '보컬 녹음 3시간', totalAmount: 250000, expiresOn: null, memo: '김준호님', sessionAt, sessionHours: 3, blockSlot: true };

  it('이용 일시가 있으면 같은 시각의 예약 불가 블록(녹음실)이 함께 만들어지고 링크가 그 id를 안다', async () => {
    const { slug, blockId } = await createPaymentLink(withSession);
    expect(blockId).toBeTruthy();
    const block = await testDb.query.availabilityBlocks.findFirst();
    expect(block).toMatchObject({ id: blockId, roomNumber: null, memo: '결제 링크 · 김준호님' });
    expect(block!.startAt.getTime()).toBe(sessionAt * 1000);
    expect(block!.endAt.getTime()).toBe((sessionAt + 3 * 3600) * 1000);
    expect(await findPaymentLink(slug, now)).toMatchObject({ sessionAt, sessionHours: 3 });
    expect((await listPaymentLinks(10, now))[0]).toMatchObject({ sessionAt, sessionHours: 3, blocked: true });
  });

  it('blockSlot이 꺼져 있거나 일시가 없으면 블록을 만들지 않는다', async () => {
    await createPaymentLink({ ...withSession, blockSlot: false });
    await createPaymentLink({ ...withSession, sessionAt: null, sessionHours: null, blockSlot: false });
    expect(await testDb.query.availabilityBlocks.findMany()).toHaveLength(0);
  });

  it('결제 없이 닫으면 블록도 풀린다', async () => {
    const { slug } = await createPaymentLink(withSession);
    expect(await closePaymentLink(slug, now)).toEqual({ closed: true, blockReleased: true });
    expect(await testDb.query.availabilityBlocks.findMany()).toHaveLength(0);
    expect((await listPaymentLinks(10, now))[0].blocked).toBe(false);
  });

  it.each(['paid', 'awaiting_deposit'])('이 링크로 %s 주문이 있으면 닫아도 블록은 남는다(그 시간은 예약된 것)', async (status) => {
    const { slug } = await createPaymentLink(withSession);
    await testDb.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
      VALUES ('o1', 'SNB-1', 'deposit', ${status}, '김', '010', 'a@b.c', 't', 227273, 22727, 250000)`);
    await testDb.run(sql`INSERT INTO payment_link_orders (order_no, slug, item_name) VALUES ('SNB-1', ${slug}, 'x')`);
    expect(await closePaymentLink(slug, now)).toEqual({ closed: true, blockReleased: false });
    expect(await testDb.query.availabilityBlocks.findMany()).toHaveLength(1);
  });

  it('관리자가 블록을 이미 지웠어도 닫기는 성공한다', async () => {
    const { slug, blockId } = await createPaymentLink(withSession);
    await testDb.delete(availabilityBlocks).where(eq(availabilityBlocks.id, blockId!));
    expect(await closePaymentLink(slug, now)).toEqual({ closed: true, blockReleased: false });
  });
});
