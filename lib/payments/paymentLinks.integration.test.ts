import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { paymentLinks } from '../../db/schema';
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
/* eslint-enable import/first */

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  brokenDb = false;
});

const now = new Date('2026-10-15T03:00:00Z'); // KST 12:00 10/15

describe('validatePaymentLinkInput', () => {
  const ok = { itemName: ' 보컬 녹음 1프로 ', totalAmount: 250000, expiresOn: '2026-10-17', memo: ' 김준호님 ' };

  it('이름·메모는 다듬고 금액은 부가세 포함 정수로 받는다', () => {
    expect(validatePaymentLinkInput(ok, now)).toEqual({ ok: true, value: { itemName: '보컬 녹음 1프로', totalAmount: 250000, expiresOn: '2026-10-17', memo: '김준호님' } });
    expect(validatePaymentLinkInput({ ...ok, totalAmount: '250000', expiresOn: '', memo: '' }, now)).toMatchObject({ ok: true, value: { totalAmount: 250000, expiresOn: null, memo: null } });
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

describe('발급·조회·닫기', () => {
  it('만든 링크는 바로 열린다 — slug는 24자리 hex, 금액·이름은 저장한 값 그대로', async () => {
    const { slug } = await createPaymentLink({ itemName: '보컬 녹음 1프로', totalAmount: 250000, expiresOn: null, memo: null });
    expect(slug).toMatch(/^[0-9a-f]{24}$/);
    expect(await findPaymentLink(slug, now)).toEqual({ itemName: '보컬 녹음 1프로', totalAmount: 250000 });
  });

  it('만료일 당일 끝까지 열리고 다음 날부터 닫힌다(KST)', async () => {
    const { slug } = await createPaymentLink({ itemName: 'x', totalAmount: 10000, expiresOn: '2026-10-17', memo: null });
    expect(await findPaymentLink(slug, new Date('2026-10-17T14:59:00Z'))).not.toBeNull(); // KST 10/17 23:59
    expect(await findPaymentLink(slug, new Date('2026-10-17T15:00:00Z'))).toBeNull(); // KST 10/18 00:00
  });

  it('닫으면 열리지 않고, 다시 닫기는 false — 닫은 시각을 덮지 않는다', async () => {
    const { slug } = await createPaymentLink({ itemName: 'x', totalAmount: 10000, expiresOn: null, memo: null });
    expect(await closePaymentLink(slug, now)).toBe(true);
    expect(await findPaymentLink(slug, now)).toBeNull();
    expect(await closePaymentLink(slug, new Date('2026-10-16T00:00:00Z'))).toBe(false);
    const row = await testDb.query.paymentLinks.findFirst();
    expect(row!.closedAt).toBe(Math.floor(now.getTime() / 1000));
  });

  it('없는 slug·형식이 틀린 slug는 null', async () => {
    expect(await findPaymentLink('0'.repeat(24), now)).toBeNull();
    expect(await findPaymentLink('../x', now)).toBeNull();
    expect(await findPaymentLink(undefined, now)).toBeNull();
    expect(await closePaymentLink('nope', now)).toBe(false);
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
