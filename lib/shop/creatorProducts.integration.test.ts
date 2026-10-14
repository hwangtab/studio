import { readFileSync } from 'node:fs';
import path from 'node:path';

import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../funding/r2', () => ({
  fundingDownloadObjectExists: jest.fn(async (key: string) => key !== 'shop/missing.zip'),
  presignFundingDownload: jest.fn(),
}));
jest.mock('./adminProducts', () => {
  const actual = jest.requireActual('./adminProducts');
  return { ...actual, loadShopProductForAdmin: jest.fn(actual.loadShopProductForAdmin) };
});

/* eslint-disable import/first */
import { isCreatorNameLocked } from '../funding/creatorProjectWrite';
import { loadShopProductForAdmin } from './adminProducts';
import {
  createDraftProduct, listProductsForCreator, loadProductForCreator, saveProduct, setPublishedByCreator, submitProduct, withdrawProduct,
} from './creatorProductWrite';
import { validateShopProductInput, type ShopProductInput } from './creatorValidation';
import { applyShopAdminAction, decideShopProduct } from './reviewDecision';
/* eslint-enable import/first */

const IMG = 'c1-11111111-1111-1111-1111-111111111111.webp';
const IMG2 = 'c1-22222222-2222-2222-2222-222222222222.webp';
const url = (name: string) => `/api/funding/media/${name}?w=800&h=600`;

const input = (over: Partial<ShopProductInput> = {}): ShopProductInput => ({
  title: '내 앨범', subtitle: null, description: '첫 문단입니다.\n\n둘째 문단입니다.', images: [url(IMG)], category: 'album', kind: 'physical',
  slug: 'my-album', shipsOn: null, editionSize: null, skus: [{ optionLabel: null, price: 20000, retired: false }], ...over,
});

const seedCreator = async (id: string, name = '아티스트 이름') => {
  await testDb.insert(fundingCreators).values({ id, email: `${id}@example.com`, name });
  await testDb.insert(shopArtists).values({ creatorId: id, slug: `artist-${id}` });
};

/** 초안을 만들어 입력을 저장한다. */
const draftWith = async (creatorId: string, value: ShopProductInput = input()) => {
  const created = await createDraftProduct(creatorId);
  if (!created.ok) throw new Error(`setup: ${created.code}`);
  const saved = await saveProduct(creatorId, created.id, value);
  if (!saved.ok) throw new Error(`setup save: ${saved.message}`);
  return created.id;
};

const approve = (id: string, extra: { slug?: string } = {}) => decideShopProduct(id, 'approve', { ...extra });
const skusOf = (productId: string) => testDb.select().from(shopProductSkus).where(eq(shopProductSkus.productId, productId));

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await seedCreator('c1');
  await seedCreator('c2', '다른 아티스트');
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.restoreAllMocks(); });

describe('초안·저장', () => {
  it('shop_artists 행이 없는 계정은 초안을 만들 수 없다', async () => {
    await testDb.insert(fundingCreators).values({ id: 'c3', email: 'c3@example.com', name: 'x' });
    expect(await createDraftProduct('c3')).toMatchObject({ ok: false, code: 'no_shop' });
  });

  it('미심사 상품은 계정당 10개까지', async () => {
    for (let i = 0; i < 10; i += 1) expect((await createDraftProduct('c1')).ok).toBe(true);
    expect(await createDraftProduct('c1')).toMatchObject({ ok: false, code: 'too_many' });
  });

  it('저장하면 새 SKU id는 서버가 db- + hex10으로 만든다', async () => {
    const id = await draftWith('c1', input({ skus: [{ optionLabel: 'A', price: 10000, retired: false }, { optionLabel: 'B', price: 12000, retired: false }] }));
    const skus = await skusOf(id);
    expect(skus).toHaveLength(2);
    for (const s of skus) {
      expect(s.id).toMatch(/^db-[0-9a-f]{10}$/);
      expect(s.lockedAt).toBeNull();
    }
  });

  it('남의 상품은 없는 것처럼 답한다(조회·저장·제출·철회·공개 모두)', async () => {
    const id = await draftWith('c1');
    expect(await loadProductForCreator('c2', id)).toBeNull();
    expect(await saveProduct('c2', id, input())).toMatchObject({ ok: false, code: 'not_found' });
    expect(await submitProduct('c2', id)).toMatchObject({ ok: false, code: 'not_found' });
    expect(await withdrawProduct('c2', id)).toMatchObject({ ok: false, code: 'not_found' });
    expect(await setPublishedByCreator('c2', id, true)).toMatchObject({ ok: false, code: 'not_found' });
    expect(await listProductsForCreator('c2')).toEqual([]);
  });

  it('파일 상품이 쓰는 주소·다른 살아 있는 상품의 주소는 거부한다', async () => {
    const a = await draftWith('c1', input({ slug: 'taken-slug' }));
    expect(a).toBeTruthy();
    const b = await createDraftProduct('c2');
    if (!b.ok) throw new Error('setup');
    expect(await saveProduct('c2', b.id, input({ slug: 'taken-slug' }))).toMatchObject({ ok: false, code: 'duplicate_slug' });
    expect(await saveProduct('c2', b.id, input({ slug: 'test-cd' }))).toMatchObject({ ok: false, code: 'duplicate_slug' });
  });

  it('아티스트 응답에 내부 메모·파일 키가 실리지 않는다', async () => {
    const id = await draftWith('c1');
    await testDb.update(shopProducts).set({ internalNote: '내부-비밀-메모', digitalFiles: JSON.stringify([{ label: 'L', key: 'shop/secret/key.zip' }]) }).where(eq(shopProducts.id, id));
    const detail = await loadProductForCreator('c1', id);
    const json = JSON.stringify(detail);
    expect(json).not.toContain('내부-비밀-메모');
    expect(json).not.toContain('secret/key.zip');
    expect(detail).not.toHaveProperty('internalNote');
    expect(detail).not.toHaveProperty('digitalFiles');
    expect(detail!.hasDownloads).toBe(true);
    expect(JSON.stringify(await listProductsForCreator('c1'))).not.toContain('내부-비밀-메모');
  });

  it('아티스트 쓰기 경로(creatorProductWrite)는 shop_skus(재고)를 만지지 않는다', () => {
    const src = readFileSync(path.join(__dirname, 'creatorProductWrite.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/shopSkus\b/);
    expect(src).not.toMatch(/shop_skus\b/);
  });
});

describe('제출·철회', () => {
  it('빈 칸이 있으면 제출하지 못하고, 다 채우면 submitted + 제출 시각', async () => {
    const created = await createDraftProduct('c1');
    if (!created.ok) throw new Error('setup');
    expect(await submitProduct('c1', created.id)).toMatchObject({ ok: false, code: 'incomplete' });
    await saveProduct('c1', created.id, input());
    const r = await submitProduct('c1', created.id, new Date('2026-10-14T00:00:00Z'));
    expect(r.ok).toBe(true);
    const [row] = await testDb.select().from(shopProducts).where(eq(shopProducts.id, created.id));
    expect(row.reviewStatus).toBe('submitted');
    expect(row.submittedAt).toBe(Math.floor(Date.parse('2026-10-14T00:00:00Z') / 1000));
  });

  it('기본 이름(이메일 앞부분)이면 제출하지 못한다', async () => {
    await testDb.update(fundingCreators).set({ name: 'c1' }).where(eq(fundingCreators.id, 'c1'));
    const id = await draftWith('c1');
    expect(await submitProduct('c1', id)).toMatchObject({ ok: false, code: 'incomplete' });
  });

  it('심사 중에는 저장할 수 없고, 철회하면 다시 고칠 수 있다', async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id);
    expect(await saveProduct('c1', id, input())).toMatchObject({ ok: false, code: 'not_editable' });
    expect((await withdrawProduct('c1', id)).ok).toBe(true);
    const [row] = await testDb.select().from(shopProducts).where(eq(shopProducts.id, id));
    expect(row).toMatchObject({ reviewStatus: 'draft', submittedAt: null });
    expect((await saveProduct('c1', id, input())).ok).toBe(true);
  });
});

describe('승인(한 묶음)', () => {
  it('slug 확정 · SKU 잠금 · 승인 상태 · 공개를 함께 한다', async () => {
    const id = await draftWith('c1', input({ skus: [{ optionLabel: 'A', price: 10000, retired: false }, { optionLabel: 'B', price: 12000, retired: false }] }));
    await submitProduct('c1', id);
    const r = await approve(id, { slug: 'final-slug' });
    expect(r).toMatchObject({ ok: true, slug: 'final-slug' });
    const [row] = await testDb.select().from(shopProducts).where(eq(shopProducts.id, id));
    expect(row).toMatchObject({ reviewStatus: 'approved', slug: 'final-slug', published: true });
    const skus = await skusOf(id);
    expect(skus.every((s) => s.lockedAt === row.updatedAt)).toBe(true);
  });

  it('남이 먼저 승인했으면 이 호출은 conflict이고 SKU를 잠그지 않는다', async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id);
    const actual = jest.requireActual('./adminProducts') as typeof import('./adminProducts');
    (loadShopProductForAdmin as jest.Mock).mockImplementationOnce(async (pid: string) => {
      const product = await actual.loadShopProductForAdmin(pid);
      // 읽은 직후 다른 운영자가 먼저 승인한다(다른 시각). SKU는 아직 안 잠긴 채로 둔다.
      await testDb.update(shopProducts).set({ reviewStatus: 'approved', updatedAt: 1 }).where(eq(shopProducts.id, pid));
      return product;
    });
    const r = await approve(id);
    expect(r).toMatchObject({ ok: false, code: 'conflict' });
    expect((await skusOf(id)).every((s) => s.lockedAt === null)).toBe(true);
  });

  it('운영자가 본 판본(제출 시각)이 아니면 conflict', async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id, new Date('2026-10-14T00:00:00Z'));
    const r = await decideShopProduct(id, 'approve', { expectedSubmittedAt: 123 });
    expect(r).toMatchObject({ ok: false, code: 'conflict' });
  });

  it('파일 상품이 이미 쓰는 주소로는 승인하지 못한다', async () => {
    const id = await draftWith('c1', input({ slug: 'my-album' }));
    await submitProduct('c1', id);
    expect(await approve(id, { slug: 'test-cd' })).toMatchObject({ ok: false, code: 'duplicate_slug' });
    expect((await testDb.select().from(shopProducts).where(eq(shopProducts.id, id)))[0].reviewStatus).toBe('submitted');
  });

  it('이미 승인된 다른 상품의 주소로는 승인하지 못한다', async () => {
    const a = await draftWith('c1', input({ slug: 'one-slug' }));
    await submitProduct('c1', a);
    expect((await approve(a)).ok).toBe(true);
    const b = await draftWith('c2', input({ slug: 'two-slug', images: [url(IMG2.replace('c1-', 'c2-'))] }));
    await submitProduct('c2', b);
    expect(await approve(b, { slug: 'one-slug' })).toMatchObject({ ok: false, code: 'duplicate_slug' });
  });

  it('디지털 상품은 파일 없이 승인하지 못한다', async () => {
    const id = await draftWith('c1', input({ kind: 'digital' }));
    await submitProduct('c1', id);
    expect(await approve(id)).toMatchObject({ ok: false, code: 'no_files' });
    expect((await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: '앨범', key: 'shop/a.zip' }] })).ok).toBe(true);
    // 판매 파일만 있고 미리듣기가 없으면 거부 — 시험 사용 상품(전자상거래법 제17조 제6항)이 먼저다.
    expect(await approve(id)).toMatchObject({ ok: false, code: 'no_files', message: expect.stringContaining('미리듣기') });
    expect((await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: '앨범', key: 'shop/a.zip' }, { label: '미리듣기', key: 'shop/a-preview.mp3', preview: true }] })).ok).toBe(true);
    expect((await approve(id)).ok).toBe(true);
  });

  it('미리듣기만 있고 판매 파일이 없어도 승인하지 못한다', async () => {
    const id = await draftWith('c1', input({ kind: 'digital' }));
    await submitProduct('c1', id);
    expect((await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: '미리듣기', key: 'shop/p.mp3', preview: true }] })).ok).toBe(true);
    expect(await approve(id)).toMatchObject({ ok: false, code: 'no_files' });
  });

  it('미리듣기와 판매 파일이 같은 키면 거부한다 — 전곡을 공짜로 받게 된다', async () => {
    const id = await draftWith('c1', input({ kind: 'digital' }));
    const r = await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: '앨범', key: 'shop/a.zip' }, { label: '미리듣기', key: 'shop/a.zip', preview: true }] });
    expect(r).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('승인된 디지털 상품은 미리듣기를 비울 수 없다', async () => {
    const id = await draftWith('c1', input({ kind: 'digital' }));
    await submitProduct('c1', id);
    await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: '앨범', key: 'shop/a.zip' }, { label: '미리듣기', key: 'shop/a-preview.mp3', preview: true }] });
    expect((await approve(id)).ok).toBe(true);
    expect(await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: '앨범', key: 'shop/a.zip' }] })).toMatchObject({ ok: false, code: 'conflict' });
  });

  it('상점 아티스트 등재가 없으면 승인하지 못한다', async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id);
    await testDb.delete(shopArtists).where(eq(shopArtists.creatorId, 'c1'));
    expect(await approve(id)).toMatchObject({ ok: false, code: 'no_artist' });
  });

  it('보완 요청·반려에는 메모가 필수이고, 판정 뒤 아티스트가 메모를 본다', async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id);
    expect(await decideShopProduct(id, 'request_changes', {})).toMatchObject({ ok: false, code: 'incomplete' });
    expect(await decideShopProduct(id, 'reject', { note: '  ' })).toMatchObject({ ok: false, code: 'incomplete' });
    expect((await decideShopProduct(id, 'request_changes', { note: '사진을 바꿔 주세요' })).ok).toBe(true);
    const detail = await loadProductForCreator('c1', id);
    expect(detail).toMatchObject({ reviewStatus: 'changes_requested', reviewNote: '사진을 바꿔 주세요' });
    expect((await saveProduct('c1', id, input({ title: '고친 제목' }))).ok).toBe(true);
  });

  it('반려하면 주소를 놓아준다', async () => {
    const id = await draftWith('c1', input({ slug: 'reuse-slug' }));
    await submitProduct('c1', id);
    expect((await decideShopProduct(id, 'reject', { note: '사유' })).ok).toBe(true);
    const other = await draftWith('c2', input({ slug: 'reuse-slug', images: [url(IMG2.replace('c1-', 'c2-'))] }));
    expect(other).toBeTruthy();
  });
});

describe('승인 뒤 잠금', () => {
  const approvedProduct = async () => {
    const id = await draftWith('c1', input({ skus: [{ optionLabel: 'A', price: 10000, retired: false }, { optionLabel: 'B', price: 12000, retired: false }] }));
    await submitProduct('c1', id);
    await approve(id);
    return id;
  };
  const withSkus = (detail: NonNullable<Awaited<ReturnType<typeof loadProductForCreator>>>, over: Partial<ShopProductInput> = {}): ShopProductInput => ({
    title: detail.title, subtitle: detail.subtitle, description: detail.description, images: detail.images, category: detail.category,
    kind: detail.kind, slug: detail.slug, shipsOn: detail.shipsOn, editionSize: detail.editionSize,
    skus: detail.skus.map((s) => ({ id: s.id, optionLabel: s.optionLabel, price: s.price, retired: s.retired })), ...over,
  });

  it('잠긴 SKU의 가격·옵션명 변경과 삭제를 거부한다', async () => {
    const id = await approvedProduct();
    const detail = (await loadProductForCreator('c1', id))!;
    const base = withSkus(detail);
    expect(await saveProduct('c1', id, { ...base, skus: base.skus.map((s, i) => (i === 0 ? { ...s, price: 99000 } : s)) })).toMatchObject({ ok: false, code: 'locked' });
    expect(await saveProduct('c1', id, { ...base, skus: base.skus.map((s, i) => (i === 0 ? { ...s, optionLabel: '바꿈' } : s)) })).toMatchObject({ ok: false, code: 'locked' });
    expect(await saveProduct('c1', id, { ...base, skus: base.skus.slice(1) })).toMatchObject({ ok: false, code: 'locked' });
    expect((await skusOf(id)).map((s) => s.price).sort()).toEqual([10000, 12000]);
  });

  it('제목·주소·분류·종류·한정 수량·발송일은 승인 뒤 바꿀 수 없다', async () => {
    const id = await approvedProduct();
    const base = withSkus((await loadProductForCreator('c1', id))!);
    for (const over of [
      { title: '다른 제목' }, { slug: 'another-slug' }, { category: 'goods' as const }, { kind: 'digital' as const }, { editionSize: 50 }, { shipsOn: '2099-01-01' },
    ]) {
      expect(await saveProduct('c1', id, { ...base, ...over })).toMatchObject({ ok: false, code: 'locked' });
    }
  });

  it('부제·소개·사진·판매 종료·새 옵션은 되고, 저장하면 creator_edited_at이 찍히고 새 옵션은 안 잠긴다', async () => {
    const id = await approvedProduct();
    const detail = (await loadProductForCreator('c1', id))!;
    const base = withSkus(detail);
    const r = await saveProduct('c1', id, {
      ...base, subtitle: '새 부제', description: '고친 소개', images: [url(IMG), url(IMG2)],
      skus: [{ ...base.skus[0], retired: true }, base.skus[1], { optionLabel: 'C', price: 15000, retired: false }],
    }, new Date('2026-10-15T00:00:00Z'));
    expect(r).toMatchObject({ ok: true, approvedEdit: true });
    const after = (await loadProductForCreator('c1', id))!;
    expect(after.creatorEditedAt).toBe(Math.floor(Date.parse('2026-10-15T00:00:00Z') / 1000));
    expect(after.skus.map((s) => [s.optionLabel, s.locked, s.retired])).toEqual([['A', true, true], ['B', true, false], ['C', false, false]]);
    expect(after.reviewStatus).toBe('approved');
  });

  it('저장 도중 승인이 SKU를 잠그면 가격 UPDATE는 0행이라 거부된다(경합)', async () => {
    const id = await draftWith('c1');
    const detail = (await loadProductForCreator('c1', id))!;
    // 읽기를 끝낸 직후, 첫 UPDATE(상품)가 실행되기 전에 SKU가 잠긴다.
    const orig = testDb.update.bind(testDb);
    jest.spyOn(testDb, 'update').mockImplementationOnce(((table: never) => {
      const b = orig(table) as never as { set: (v: never) => { where: (c: never) => PromiseLike<unknown> } };
      return {
        set: (v: never) => {
          const s = b.set(v);
          return { where: (c: never) => { const w = s.where(c); return { then: (res: never, rej: never) => testDb.run(sql`UPDATE shop_product_skus SET locked_at = 5 WHERE product_id = ${id}`).then(() => w).then(res, rej) }; } };
        },
      };
    }) as never);
    const r = await saveProduct('c1', id, { ...withSkus(detail), skus: detail.skus.map((s) => ({ id: s.id, optionLabel: s.optionLabel, price: 99990, retired: false })) });
    expect(r).toMatchObject({ ok: false, code: 'not_editable' });
    expect((await skusOf(id))[0].price).toBe(20000);
  });

  it('공개 여부는 승인된 상품만 바꾼다', async () => {
    const id = await draftWith('c1');
    expect(await setPublishedByCreator('c1', id, true)).toMatchObject({ ok: false, code: 'not_editable' });
    await submitProduct('c1', id);
    await approve(id);
    expect((await setPublishedByCreator('c1', id, false)).ok).toBe(true);
    expect((await loadProductForCreator('c1', id))!.published).toBe(false);
    expect((await setPublishedByCreator('c1', id, true)).ok).toBe(true);
  });
});

describe('관리자 액션', () => {
  const approvedWithNewSku = async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id);
    await approve(id);
    const detail = (await loadProductForCreator('c1', id))!;
    await saveProduct('c1', id, {
      title: detail.title, subtitle: null, description: detail.description, images: detail.images, category: detail.category, kind: detail.kind,
      slug: detail.slug, shipsOn: null, editionSize: null,
      skus: [...detail.skus.map((s) => ({ id: s.id, optionLabel: s.optionLabel, price: s.price, retired: s.retired })), { optionLabel: '새 옵션', price: 30000, retired: false }].map((s, i, all) => (all.length > 1 && !s.optionLabel ? { ...s, optionLabel: '기본' } : s)),
    });
    return id;
  };

  it('새 옵션 승인은 아직 안 잠긴 SKU만 잠근다', async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id);
    await approve(id);
    expect(await applyShopAdminAction(id, { type: 'lock_new_skus', skus: [] })).toMatchObject({ ok: false, code: 'conflict' });
    await testDb.update(shopProductSkus).set({ optionLabel: '기본' }).where(eq(shopProductSkus.productId, id));
    await testDb.insert(shopProductSkus).values({ id: 'db-aaaaaaaaaa', productId: id, optionLabel: '새 옵션', price: 30000 });
    expect(await applyShopAdminAction(id, { type: 'lock_new_skus', skus: [{ id: 'db-aaaaaaaaaa', price: 30000, optionLabel: '새 옵션' }] })).toMatchObject({ ok: true, locked: 1 });
    expect((await skusOf(id)).every((s) => s.lockedAt !== null)).toBe(true);
  });

  it('디지털 파일은 shop/ 접두사·저장소 존재를 확인한다', async () => {
    const id = await draftWith('c1', input({ kind: 'digital' }));
    expect(await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: 'x', key: 'funding/x.zip' }] })).toMatchObject({ ok: false, code: 'invalid' });
    expect(await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: 'x', key: 'shop/../x.zip' }] })).toMatchObject({ ok: false, code: 'invalid' });
    expect(await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: 'x', key: 'shop/missing.zip' }] })).toMatchObject({ ok: false, code: 'invalid' });
    expect((await applyShopAdminAction(id, { type: 'set_digital_files', files: [{ label: '앨범', key: 'shop/ok/a.zip' }] })).ok).toBe(true);
  });

  it('예약 발송일·내부 메모·공개 토글', async () => {
    const id = await approvedWithNewSku();
    expect((await applyShopAdminAction(id, { type: 'set_ships_on', shipsOn: '2026-12-01' })).ok).toBe(true);
    expect(await applyShopAdminAction(id, { type: 'set_ships_on', shipsOn: '내일' })).toMatchObject({ ok: false, code: 'invalid' });
    expect((await applyShopAdminAction(id, { type: 'set_internal_note', note: '메모' })).ok).toBe(true);
    expect((await applyShopAdminAction(id, { type: 'set_published', published: false })).ok).toBe(true);
    const row = (await testDb.select().from(shopProducts).where(eq(shopProducts.id, id)))[0];
    expect(row).toMatchObject({ shipsOn: '2026-12-01', internalNote: '메모', published: false });
    expect(JSON.stringify(await loadProductForCreator('c1', id))).not.toContain('메모');
  });
});

describe('이름 잠금이 상점 상품도 본다(hasReviewedProject)', () => {
  it('상점 상품이 심사 중이면 이름이 잠긴다', async () => {
    expect(await isCreatorNameLocked('c1')).toBe(false);
    const id = await draftWith('c1');
    expect(await isCreatorNameLocked('c1')).toBe(false); // 초안은 잠그지 않는다
    await submitProduct('c1', id);
    expect(await isCreatorNameLocked('c1')).toBe(true);
    await approve(id);
    expect(await isCreatorNameLocked('c1')).toBe(true);
  });

  it('반려되면 다시 풀리고, 상점 표가 없는 DB에서는 펀딩 판정만 따른다', async () => {
    const id = await draftWith('c1');
    await submitProduct('c1', id);
    await decideShopProduct(id, 'reject', { note: '사유' });
    expect(await isCreatorNameLocked('c1')).toBe(false);
    await testDb.run(sql`DROP TABLE shop_product_skus`);
    await testDb.run(sql`DROP TABLE shop_products`);
    expect(await isCreatorNameLocked('c1')).toBe(false);
  });
});

describe('validateShopProductInput', () => {
  const media = { creatorId: 'c1' };
  it('가격은 1,000~1,000,000원 정수·10원 단위', () => {
    for (const price of [999, 1_000_010, 1500.5, 1005, '2000', Number.NaN]) {
      expect(validateShopProductInput({ ...input(), skus: [{ optionLabel: null, price, retired: false }] }, media).ok).toBe(false);
    }
    expect(validateShopProductInput({ ...input(), skus: [{ optionLabel: null, price: 1_000_000, retired: false }] }, media).ok).toBe(true);
  });

  it('한정 번호는 실물에만 — 디지털 상품의 한정 수량은 거부', () => {
    expect(validateShopProductInput({ ...input(), kind: 'digital', editionSize: 100 }, media).ok).toBe(false);
    expect(validateShopProductInput({ ...input(), kind: 'physical', editionSize: 100 }, media).ok).toBe(true);
  });

  it('사진은 자기 업로드만, 8장·옵션은 12개까지', () => {
    expect(validateShopProductInput({ ...input(), images: [url('c2-33333333-3333-3333-3333-333333333333.webp')] }, media).ok).toBe(false);
    expect(validateShopProductInput({ ...input(), images: ['https://evil.example/x.webp'] }, media).ok).toBe(false);
    const many = Array.from({ length: 9 }, (_, i) => url(`c1-${String(i).repeat(8)}-0000-0000-0000-000000000000.webp`));
    expect(validateShopProductInput({ ...input(), images: many }, media).ok).toBe(false);
    const skus = Array.from({ length: 13 }, (_, i) => ({ optionLabel: `o${i}`, price: 10000, retired: false }));
    expect(validateShopProductInput({ ...input(), skus }, media).ok).toBe(false);
  });

  it('주소는 예약어·임시 접두사·형식을 거른다, 빈 주소는 통과', () => {
    for (const slug of ['artist', 'success', 'draft-abc', 'Bad Slug', 'ab']) {
      expect(validateShopProductInput({ ...input(), slug }, media).ok).toBe(false);
    }
    expect(validateShopProductInput({ ...input(), slug: '' }, media).ok).toBe(true);
  });
});
