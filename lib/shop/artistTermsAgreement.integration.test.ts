import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, shopArtists, shopArtistTermsAgreements } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../funding/r2', () => ({ fundingDownloadObjectExists: jest.fn(async () => true), presignFundingDownload: jest.fn() }));

/* eslint-disable import/first */
import { approveShopProductNow, createDraftProductAsAdmin, saveProductAsAdmin } from './adminProductWrite';
import { describeShopArtistTerms, SHOP_ARTIST_TERMS_VERSION } from './artistTerms';
import {
  hasAgreedCurrentShopArtistTerms, loadShopArtistTermsStatus, loadShopArtistTermsStatuses, recordShopArtistTermsAgreement,
} from './artistTermsAgreement';
import { decideShopProduct } from './reviewDecision';
/* eslint-enable import/first */

/**
 * 상점 위탁 약관 동의 기록과 승인 게이트. 판정은 "현재 판본 행이 있는가" 하나이고, 표가 없으면 미동의(fail-closed)다.
 */

const OLD_VERSION = 'shop-artist-terms-2026-01-01';
const IMG = (creatorId: string) => `/api/funding/media/${creatorId}-11111111-1111-1111-1111-111111111111.webp?w=800&h=600`;
const value = (creatorId: string, slug: string) => ({
  title: '위탁 상품', subtitle: '', description: '첫 문단입니다.', images: [IMG(creatorId)], category: 'goods', kind: 'physical',
  slug, shipsOn: null, editionSize: null, skus: [{ optionLabel: '', price: 20000, retired: false }],
});

const seedArtist = async (id = 'c1') => {
  await testDb.insert(fundingCreators).values({ id, email: `${id}@example.com`, name: `아티스트${id}` });
  await testDb.insert(shopArtists).values({ creatorId: id, slug: `artist-${id}` });
};

const draft = async (creator: { creatorId: string } | { studio: true }, slug: string) => {
  const created = await createDraftProductAsAdmin(creator);
  if (!created.ok) throw new Error(`setup: ${created.code}`);
  const saved = await saveProductAsAdmin(created.id, value(created.creatorId, slug));
  if (!saved.ok) throw new Error(`setup save: ${saved.message}`);
  return created.id;
};

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('동의 기록', () => {
  it('동의 전에는 미동의, 동의하면 현재 판본·시각이 남는다', async () => {
    await seedArtist();
    expect(await loadShopArtistTermsStatus('c1')).toEqual({ state: 'none', version: null, agreedAt: null });
    expect(await hasAgreedCurrentShopArtistTerms('c1')).toBe(false);

    const at = new Date('2026-10-14T03:00:00Z');
    expect(await recordShopArtistTermsAgreement('c1', SHOP_ARTIST_TERMS_VERSION, at)).toEqual({ ok: true, agreedAt: at.getTime() / 1000 });
    expect(await loadShopArtistTermsStatus('c1')).toEqual({ state: 'agreed', version: SHOP_ARTIST_TERMS_VERSION, agreedAt: at.getTime() / 1000 });
    expect(describeShopArtistTerms(await loadShopArtistTermsStatus('c1'), false)).toBe(`동의 (${SHOP_ARTIST_TERMS_VERSION} · 2026-10-14 12:00 KST)`);
  });

  it('같은 판본에 다시 동의해도 처음 동의한 시각을 그대로 둔다', async () => {
    await seedArtist();
    await recordShopArtistTermsAgreement('c1', SHOP_ARTIST_TERMS_VERSION, new Date(1_790_000_000_000));
    expect(await recordShopArtistTermsAgreement('c1', SHOP_ARTIST_TERMS_VERSION, new Date(1_800_000_000_000))).toEqual({ ok: true, agreedAt: 1_790_000_000 });
    expect(await testDb.select().from(shopArtistTermsAgreements)).toHaveLength(1);
  });

  it('화면이 본 판본이 지금 판본과 다르면 거부한다', async () => {
    await seedArtist();
    expect(await recordShopArtistTermsAgreement('c1', OLD_VERSION)).toMatchObject({ ok: false, code: 'stale_version' });
    expect(await testDb.select().from(shopArtistTermsAgreements)).toHaveLength(0);
  });

  it('상점에 등재되지 않은 계정은 동의를 남기지 못한다', async () => {
    await testDb.insert(fundingCreators).values({ id: 'x', email: 'x@example.com', name: '엑스' });
    expect(await recordShopArtistTermsAgreement('x', SHOP_ARTIST_TERMS_VERSION)).toMatchObject({ ok: false, code: 'no_shop' });
    expect(await testDb.select().from(shopArtistTermsAgreements)).toHaveLength(0);
  });

  it('판본이 바뀌면 옛 동의는 증거로 남고, 현재 판본에는 다시 동의해야 한다', async () => {
    await seedArtist();
    await testDb.insert(shopArtistTermsAgreements).values({ creatorId: 'c1', termsVersion: OLD_VERSION, agreedAt: 1_780_000_000 });
    expect(await loadShopArtistTermsStatus('c1')).toEqual({ state: 'outdated', version: OLD_VERSION, agreedAt: 1_780_000_000 });
    expect(await hasAgreedCurrentShopArtistTerms('c1')).toBe(false);
    expect(describeShopArtistTerms(await loadShopArtistTermsStatus('c1'), false)).toMatch(/^옛 판본 동의 \(shop-artist-terms-2026-01-01 · .+\) — 현재 판본 미동의$/);

    expect((await recordShopArtistTermsAgreement('c1', SHOP_ARTIST_TERMS_VERSION)).ok).toBe(true);
    expect(await hasAgreedCurrentShopArtistTerms('c1')).toBe(true);
    const rows = await testDb.select().from(shopArtistTermsAgreements).where(eq(shopArtistTermsAgreements.creatorId, 'c1'));
    expect(rows.map((r) => r.termsVersion).sort()).toEqual([OLD_VERSION, SHOP_ARTIST_TERMS_VERSION].sort());
  });

  it('여러 계정을 한 번에 읽는다(관리자 목록)', async () => {
    await seedArtist('c1');
    await seedArtist('c2');
    await recordShopArtistTermsAgreement('c1', SHOP_ARTIST_TERMS_VERSION);
    const map = await loadShopArtistTermsStatuses(['c1', 'c2']);
    expect(map.get('c1')?.state).toBe('agreed');
    expect(map.get('c2')?.state).toBe('none');
    expect(describeShopArtistTerms(map.get('c2') ?? null, false)).toBe('미동의');
    expect(describeShopArtistTerms(null, true)).toBe('해당 없음(스튜디오 상품)');
  });

  it('표가 없는 DB(0059 전)는 미동의로 보고, 동의 저장은 실패로 알린다', async () => {
    await seedArtist();
    await testDb.run(sql`DROP TABLE shop_artist_terms_agreements`);
    expect(await loadShopArtistTermsStatus('c1')).toEqual({ state: 'none', version: null, agreedAt: null });
    expect(await hasAgreedCurrentShopArtistTerms('c1')).toBe(false);
    expect(await recordShopArtistTermsAgreement('c1', SHOP_ARTIST_TERMS_VERSION)).toMatchObject({ ok: false, code: 'unavailable' });
  });

  it('표가 없다는 오류 말고는 삼키지 않는다', async () => {
    await seedArtist();
    jest.spyOn(testDb, 'all').mockRejectedValueOnce(new Error('연결 끊김'));
    await expect(loadShopArtistTermsStatus('c1')).rejects.toThrow('연결 끊김');
  });
});

describe('승인 게이트', () => {
  it('미동의 아티스트의 상품은 심사 승인도 바로 승인도 terms_not_agreed로 거부되고, 바로 승인은 상태를 되돌린다', async () => {
    await seedArtist();
    const id = await draft({ creatorId: 'c1' }, 'consign-a');

    expect(await approveShopProductNow(id, {})).toMatchObject({ ok: false, code: 'terms_not_agreed' });
    const [row] = await testDb.all<{ review_status: string }>(sql`SELECT review_status FROM shop_products WHERE id = ${id}`);
    expect(row.review_status).toBe('draft');

    await testDb.run(sql`UPDATE shop_products SET review_status = 'submitted', submitted_at = 100 WHERE id = ${id}`);
    expect(await decideShopProduct(id, 'approve', {})).toMatchObject({ ok: false, code: 'terms_not_agreed' });
    // 보완 요청·반려는 동의와 무관하게 할 수 있다.
    expect((await decideShopProduct(id, 'request_changes', { note: '약관 동의 부탁드려요' })).ok).toBe(true);
  });

  it('옛 판본에만 동의했으면 거부하고, 현재 판본에 동의하면 승인된다', async () => {
    await seedArtist();
    await testDb.insert(shopArtistTermsAgreements).values({ creatorId: 'c1', termsVersion: OLD_VERSION, agreedAt: 1_780_000_000 });
    const id = await draft({ creatorId: 'c1' }, 'consign-b');
    expect(await approveShopProductNow(id, {})).toMatchObject({ ok: false, code: 'terms_not_agreed' });

    await recordShopArtistTermsAgreement('c1', SHOP_ARTIST_TERMS_VERSION);
    expect(await approveShopProductNow(id, {})).toMatchObject({ ok: true, slug: 'consign-b' });
  });

  it('표가 없는 DB에서는 아티스트 상품을 승인하지 않는다(fail-closed)', async () => {
    await seedArtist();
    const id = await draft({ creatorId: 'c1' }, 'consign-c');
    await testDb.run(sql`DROP TABLE shop_artist_terms_agreements`);
    expect(await approveShopProductNow(id, {})).toMatchObject({ ok: false, code: 'terms_not_agreed' });
  });

  it('스튜디오 상품 계정은 위탁 계약이 없어 동의 없이 승인된다(표가 없어도)', async () => {
    const id = await draft({ studio: true }, 'studio-own');
    await testDb.run(sql`DROP TABLE shop_artist_terms_agreements`);
    expect(await approveShopProductNow(id, {})).toMatchObject({ ok: true, slug: 'studio-own' });
  });
});
