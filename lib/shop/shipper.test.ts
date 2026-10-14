import { validateShopCatalog } from './catalog';
import { canShareOrder, hasMixedKinds, hasMixedShippers, shipperGroupOf } from './shipper';

const studio = { kind: 'physical' as const };
const artistA = { kind: 'physical' as const, shippedByArtist: 'artist-a' };
const artistB = { kind: 'physical' as const, shippedByArtist: 'artist-b' };
const digital = { kind: 'digital' as const };

describe('발송 주체 묶음', () => {
  it('실물은 스튜디오 또는 아티스트 slug로 묶이고, 디지털은 어디에도 묶이지 않는다', () => {
    expect(shipperGroupOf(studio)).toBe('studio');
    expect(shipperGroupOf({})).toBe('studio');
    expect(shipperGroupOf(artistA)).toBe('artist:artist-a');
    expect(shipperGroupOf(digital)).toBeNull();
    expect(shipperGroupOf({ kind: 'digital', shippedByArtist: 'artist-a' })).toBeNull();
  });

  it('함께 담을 수 있는 쌍', () => {
    expect(canShareOrder(studio, studio)).toBe(true);
    expect(canShareOrder(artistA, artistA)).toBe(true);
    expect(canShareOrder(artistA, studio)).toBe(false);
    expect(canShareOrder(studio, artistA)).toBe(false);
    expect(canShareOrder(artistA, artistB)).toBe(false);
    // 실물과 디지털은 한 주문에 담지 않는다 — 디지털을 내려받으면 실물의 "발송 전 취소"까지 막힌다.
    expect(canShareOrder(artistA, digital)).toBe(false);
    expect(canShareOrder(digital, studio)).toBe(false);
    expect(canShareOrder(digital, digital)).toBe(true);
  });

  it('종류 섞임 판정', () => {
    expect(hasMixedKinds([])).toBe(false);
    expect(hasMixedKinds([digital, digital])).toBe(false);
    expect(hasMixedKinds([studio, artistA])).toBe(false);
    expect(hasMixedKinds([studio, digital])).toBe(true);
    expect(hasMixedKinds([{}, digital])).toBe(true);
  });

  it('섞임 판정 — 디지털은 세지 않는다', () => {
    expect(hasMixedShippers([])).toBe(false);
    expect(hasMixedShippers([studio, studio])).toBe(false);
    expect(hasMixedShippers([artistA, artistA, digital])).toBe(false);
    expect(hasMixedShippers([artistA, studio])).toBe(true);
    expect(hasMixedShippers([artistA, artistB, digital])).toBe(true);
    expect(hasMixedShippers([digital, studio, artistA])).toBe(true);
  });
});

describe('파일 카탈로그', () => {
  it('파일 상품은 아티스트 직접 발송을 쓸 수 없다', () => {
    const product = {
      slug: 'x-cd', category: 'album' as const, title: 'X', description: ['소개'], images: [], published: false,
      skus: [{ id: 'x-cd-std', price: 10000 }], shippedByArtist: 'artist-a',
    };
    expect(validateShopCatalog([product]).join('\n')).toContain('shippedByArtist');
    expect(validateShopCatalog([{ ...product, shippedByArtist: undefined }]).join('\n')).not.toContain('shippedByArtist');
  });
});
