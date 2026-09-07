import { computeAmounts } from './amounts';
import { getProduct, productsForService, resolveHours } from './products';

describe('SESSION_PRODUCTS', () => {
  it('smoke-test 픽스처는 고객 서비스 4종 어디에도 섞이지 않는다', () => {
    for (const svc of ['recording', 'voice-acting', 'wedding-song', 'cover-video']) {
      expect(productsForService(svc).map((p) => p.id)).not.toContain('smoke-test');
    }
    expect(productsForService('smoke-test').map((p) => p.id)).toEqual(['smoke-test']);
  });
  it('세션 4서비스의 상품이 전부 있다', () => {
    for (const id of ['recording-pro', 'recording-hourly', 'voice-acting-hourly', 'wedding-song', 'cover-video']) {
      expect(getProduct(id)).toBeDefined();
    }
  });
});

describe('resolveHours', () => {
  it('패키지는 요청 시간과 무관하게 고정 시간', () => {
    expect(resolveHours(getProduct('recording-pro')!, undefined)).toBe(3);
  });
  it('시간제는 min~max 밖이면 null', () => {
    const hourly = getProduct('recording-hourly')!;
    expect(resolveHours(hourly, 1)).toBeNull();
    expect(resolveHours(hourly, 9)).toBeNull();
    expect(resolveHours(hourly, 4)).toBe(4);
    expect(resolveHours(hourly, undefined)).toBeNull();
  });
});

describe('computeAmounts', () => {
  it('1프로 25만원 → VAT 포함 275,000', () => {
    expect(computeAmounts(getProduct('recording-pro')!, 3)).toEqual({
      itemAmount: 250000, vatAmount: 25000, totalAmount: 275000,
    });
  });
  it('시간제 4시간 = 40만 + VAT 4만', () => {
    expect(computeAmounts(getProduct('recording-hourly')!, 4)).toEqual({
      itemAmount: 400000, vatAmount: 40000, totalAmount: 440000,
    });
  });
});
