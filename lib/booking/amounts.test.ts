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
    for (const id of ['recording-pro', 'recording-hourly', 'recording-daylock-4h', 'recording-daylock-8h', 'voice-acting-hourly', 'wedding-song', 'cover-video']) {
      expect(getProduct(id)).toBeDefined();
    }
  });
});

describe('resolveHours', () => {
  it('패키지는 요청 시간과 무관하게 고정 시간', () => {
    expect(resolveHours(getProduct('recording-pro')!, undefined)).toBe(3);
    // Day Lock도 패키지 — 요청한 시간이 무엇이든 4·8시간으로 고정되고 금액은 정찰가 그대로다.
    expect(resolveHours(getProduct('recording-daylock-4h')!, 2)).toBe(4);
    expect(resolveHours(getProduct('recording-daylock-8h')!, 2)).toBe(8);
    expect(computeAmounts(getProduct('recording-daylock-4h')!, 4).itemAmount).toBe(350000);
    expect(computeAmounts(getProduct('recording-daylock-8h')!, 8).itemAmount).toBe(650000);
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

describe('연습실 시간제 청구액 — 소비자가 4,400원(VAT 포함) × 시간', () => {
  it('3시간이면 공급가 12,000 + VAT 1,200 = 13,200원 — 4,400×3과 정확히 같다', () => {
    const p = getProduct('practice-room-hourly')!;
    expect(computeAmounts(p, 3)).toEqual({ itemAmount: 12000, vatAmount: 1200, totalAmount: 13200 });
  });
  it('1시간은 4,400원 그대로 — 4,840원(VAT 별도 착각)이 되면 안 된다', () => {
    expect(computeAmounts(getProduct('practice-room-hourly')!, 1).totalAmount).toBe(4400);
  });
});
