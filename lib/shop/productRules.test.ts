import { fundingReviewStatusEnum, shopProductReviewStatusEnum } from '../../db/schema';
import {
  DB_SKU_PREFIX, SHOP_CREATOR_LIMITS, SHOP_PRODUCT_EDITABLE, SHOP_REVIEW_STATUSES, canCreatorEditShopField, canCreatorEditShopProduct, isDbSkuId,
  type ShopProductEditableField, type ShopReviewStatus,
} from './productRules';

describe('상점 DB 상품 규칙', () => {
  it('심사 상태 집합이 펀딩과 같다(리터럴 유니온·스키마 enum 모두)', () => {
    expect([...SHOP_REVIEW_STATUSES]).toEqual([...fundingReviewStatusEnum]);
    expect([...shopProductReviewStatusEnum]).toEqual([...fundingReviewStatusEnum]);
  });

  it('상태마다 편집 가능 칸이 정의돼 있고, 제출·반려 중에는 아무것도 못 고친다', () => {
    expect(Object.keys(SHOP_PRODUCT_EDITABLE).sort()).toEqual([...SHOP_REVIEW_STATUSES].sort());
    expect(SHOP_PRODUCT_EDITABLE.submitted).toEqual([]);
    expect(SHOP_PRODUCT_EDITABLE.approved).not.toContain('title');
    expect(SHOP_PRODUCT_EDITABLE.approved).not.toContain('slug');
  });

  it('db- 접두사로만 DB SKU를 판정한다', () => {
    expect(DB_SKU_PREFIX).toBe('db-');
    expect(isDbSkuId('db-0123456789')).toBe(true);
    expect(isDbSkuId('test-cd-std')).toBe(false);
    expect(isDbSkuId('DB-1')).toBe(false);
    expect(isDbSkuId(undefined)).toBe(false);
    expect(isDbSkuId(123)).toBe(false);
  });

  it('상태 × 칸 전수 — 열린 칸이 표와 정확히 같다', () => {
    const ALL: ShopProductEditableField[] = [
      'title', 'subtitle', 'description', 'images', 'category', 'kind', 'slug', 'shipsOn', 'editionSize', 'skus', 'published',
    ];
    const editable = ['title', 'subtitle', 'description', 'images', 'category', 'kind', 'slug', 'shipsOn', 'editionSize', 'skus'];
    const EXPECTED: Record<ShopReviewStatus, string[]> = {
      draft: editable,
      changes_requested: editable,
      submitted: [],
      rejected: [],
      approved: ['subtitle', 'description', 'images', 'skus', 'published'],
    };
    for (const status of SHOP_REVIEW_STATUSES) {
      for (const field of ALL) {
        expect([status, field, canCreatorEditShopField(status, field)]).toEqual([status, field, EXPECTED[status].includes(field)]);
      }
      expect(canCreatorEditShopProduct(status)).toBe(EXPECTED[status].length > 0);
    }
  });

  it('승인 뒤 잠기는 것: 제목·주소·분류·종류·발송일·한정 수량', () => {
    for (const field of ['title', 'slug', 'category', 'kind', 'shipsOn', 'editionSize'] as const) {
      expect(canCreatorEditShopField('approved', field)).toBe(false);
    }
  });

  it('한도는 화면과 서버가 같은 상수 하나', () => {
    expect(SHOP_CREATOR_LIMITS).toMatchObject({ imagesMax: 8, skusMax: 12, priceMin: 1_000, priceMax: 1_000_000, priceStep: 10 });
  });
});
