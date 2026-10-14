/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, shopProducts, shopProductSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../funding/r2', () => ({ presignFundingDownload: jest.fn(), fundingDownloadObjectExists: jest.fn() }));

/* eslint-disable import/first */
import handler from '../../pages/api/shop/preview';
import { consumeRateLimit } from '../booking/rate-limit';
import { presignFundingDownload } from '../funding/r2';
/* eslint-enable import/first */

const FILES = JSON.stringify([
  { label: '앨범', key: 'shop/dig/album.zip' },
  { label: '미리듣기 A', key: 'shop/dig/a-prev.mp3', preview: true },
  { label: '미리듣기 B', key: 'shop/dig/b-prev.mp3', preview: true },
]);
const SIGNED = 'https://acct.r2.cloudflarestorage.com/bucket/shop/dig/a-prev.mp3?X-Amz-Signature=beef';

const seed = async (slug: string, over: Partial<typeof shopProducts.$inferInsert> = {}) => {
  await testDb.insert(shopProducts).values({
    id: `p-${slug}`, creatorId: 'c1', slug, category: 'album', kind: 'digital', title: slug, description: '소개', images: '[]',
    reviewStatus: 'approved', published: true, digitalFiles: FILES, ...over,
  });
  await testDb.insert(shopProductSkus).values({ id: `db-${slug.padEnd(10, 'x').slice(0, 10)}`, productId: `p-${slug}`, price: 5000, lockedAt: 1 });
};

const call = async (query: Record<string, string>, method = 'GET') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const redirect = jest.fn();
  const setHeader = jest.fn();
  await handler({ method, query, headers: {}, socket: {} } as unknown as NextApiRequest, { setHeader, status, redirect } as unknown as NextApiResponse);
  return { status: status.mock.calls[0]?.[0] as number | undefined, redirect: redirect.mock.calls[0] as [number, string] | undefined, setHeader };
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: '아티스트' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (presignFundingDownload as jest.Mock).mockResolvedValue(SIGNED);
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('GET /api/shop/preview', () => {
  it('승인·공개된 디지털 상품의 미리듣기를 inline 서명 주소로 302한다(no-store)', async () => {
    await seed('dig');
    const r = await call({ product: 'dig', i: '1' });
    expect(r.redirect).toEqual([302, SIGNED]);
    expect(presignFundingDownload).toHaveBeenCalledWith('shop/dig/b-prev.mp3', { inline: true, ttlSeconds: 300 });
    expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('판매 파일은 순번이 얼마든 닿지 않는다 — 미리듣기 순번만 센다', async () => {
    await seed('dig');
    expect((await call({ product: 'dig', i: '2' })).status).toBe(404);
    expect((await call({ product: 'dig', i: '5' })).status).toBe(404);
    const keys = (presignFundingDownload as jest.Mock).mock.calls.map((c) => c[0]);
    expect(keys).not.toContain('shop/dig/album.zip');
  });

  it.each([
    ['미승인', { reviewStatus: 'submitted' as const }],
    ['비공개', { published: false }],
    ['실물 상품', { kind: 'physical' as const }],
  ])('%s 상품은 404', async (_l, over) => {
    await seed('hid', over);
    expect((await call({ product: 'hid', i: '0' })).status).toBe(404);
    expect(presignFundingDownload).not.toHaveBeenCalled();
  });

  it('없는 상품 404, 형식 오류 400', async () => {
    expect((await call({ product: 'nope', i: '0' })).status).toBe(404);
    expect((await call({ product: 'dig', i: '-1' })).status).toBe(400);
    expect((await call({ product: 'DIG/../x', i: '0' })).status).toBe(400);
    expect((await call({ i: '0' } as never)).status).toBe(400);
  });

  it('GET·HEAD만 받는다', async () => {
    await seed('dig');
    expect((await call({ product: 'dig', i: '0' }, 'POST')).status).toBe(405);
    expect((await call({ product: 'dig', i: '0' }, 'DELETE')).status).toBe(405);
  });

  it('레이트리밋이 걸리면 429', async () => {
    await seed('dig');
    (consumeRateLimit as jest.Mock).mockResolvedValueOnce(false);
    expect((await call({ product: 'dig', i: '0' })).status).toBe(429);
    expect(presignFundingDownload).not.toHaveBeenCalled();
  });

  it('서명 실패는 503 — 키를 응답에 싣지 않는다', async () => {
    await seed('dig');
    (presignFundingDownload as jest.Mock).mockRejectedValueOnce(new Error('R2 down shop/dig/a-prev.mp3'));
    const r = await call({ product: 'dig', i: '0' });
    expect(r.status).toBe(503);
  });
});
