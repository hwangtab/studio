import { fundingReviewStatusEnum, shopProductReviewStatusEnum } from '../../db/schema';
import { DB_SKU_PREFIX, SHOP_PRODUCT_EDITABLE, SHOP_REVIEW_STATUSES, isDbSkuId } from './productRules';

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
});
