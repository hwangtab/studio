import { addVatToSupply, computeAmounts, splitInclusiveAmount } from './amounts';
import { getProduct, productsForService, resolveHours, SESSION_PRODUCTS } from './products';
import {
  COVER_VIDEO_PACKAGE_PRICE,
  DAY_LOCK_4H_PRICE,
  DAY_LOCK_8H_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

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
    // 표기가(350,000 / 650,000)가 곧 청구액이다 — 2026-10-15부터 VAT 포함 표기.
    expect(computeAmounts(getProduct('recording-daylock-4h')!, 4).totalAmount).toBe(350000);
    expect(computeAmounts(getProduct('recording-daylock-8h')!, 8).totalAmount).toBe(650000);
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
  it('1프로 표기가 25만원(VAT 포함) = 청구 250,000 — 공급가 227,273 + VAT 22,727', () => {
    expect(computeAmounts(getProduct('recording-pro')!, 3)).toEqual({
      itemAmount: 227273, vatAmount: 22727, totalAmount: 250000,
    });
  });
  it('시간제 4시간 = 표기 시간당 10만원 × 4 = 400,000 (공급가 363,636 + VAT 36,364)', () => {
    expect(computeAmounts(getProduct('recording-hourly')!, 4)).toEqual({
      itemAmount: 363636, vatAmount: 36364, totalAmount: 400000,
    });
  });
  it('공급가 + VAT는 언제나 합계와 같다(반올림이 새지 않는다)', () => {
    for (const total of [1, 99, 100_000, 250_000, 350_000, 545_455, 1_227_273]) {
      const a = splitInclusiveAmount(total);
      expect(a.itemAmount + a.vatAmount).toBe(a.totalAmount);
      expect(a.totalAmount).toBe(total);
    }
  });
});

describe('표기가 = 청구액 (2026-10-15 VAT 포함 정책 가드)', () => {
  const customerProducts = SESSION_PRODUCTS.filter((p) => p.id !== 'smoke-test');

  it('세션 상품은 어떤 시간으로 계산해도 합계가 표기 단가(패키지) 또는 단가 × 시간이다 — 10%가 위에 얹히지 않는다', () => {
    for (const p of customerProducts) {
      const hours = (p.kind === 'package' ? p.sessionHours : (p.minHours ?? 1) + 1) ?? 1;
      const expected = p.kind === 'package' ? p.unitAmount : p.unitAmount * hours;
      expect(computeAmounts(p, hours).totalAmount).toBe(expected);
    }
  });

  it('표기 단가는 data/pricing.ts의 VAT 포함 가격 그대로다', () => {
    expect(getProduct('recording-pro')!.unitAmount).toBe(VOCAL_PACKAGE_PRICE);
    expect(getProduct('recording-hourly')!.unitAmount).toBe(RECORDING_HOURLY_PRICE);
    expect(getProduct('recording-daylock-4h')!.unitAmount).toBe(DAY_LOCK_4H_PRICE);
    expect(getProduct('recording-daylock-8h')!.unitAmount).toBe(DAY_LOCK_8H_PRICE);
    expect(getProduct('voice-acting-hourly')!.unitAmount).toBe(VOICEOVER_HOURLY_PRICE);
    expect(getProduct('wedding-song')!.unitAmount).toBe(WEDDING_PACKAGE_PRICE);
    expect(getProduct('cover-video')!.unitAmount).toBe(COVER_VIDEO_PACKAGE_PRICE);
  });

  it('결제 연동 테스트 상품은 220원 결제(공급가 200 + VAT 20)', () => {
    expect(computeAmounts(getProduct('smoke-test')!, 1)).toEqual({ itemAmount: 200, vatAmount: 20, totalAmount: 220 });
  });

  it('예외 — 월 이용료·레슨처럼 표기가 별도인 상품은 addVatToSupply로 공급가 + 10%를 청구한다', () => {
    expect(addVatToSupply(360000)).toEqual({ itemAmount: 360000, vatAmount: 36000, totalAmount: 396000 });
    expect(addVatToSupply(350000)).toEqual({ itemAmount: 350000, vatAmount: 35000, totalAmount: 385000 });
  });
});

describe('연습실 시간제 청구액 — 소비자가 6,600원(VAT 포함) × 시간', () => {
  it('3시간이면 공급가 18,000 + VAT 1,800 = 19,800원 — 6,600×3과 정확히 같다', () => {
    const p = getProduct('practice-room-hourly')!;
    expect(computeAmounts(p, 3)).toEqual({ itemAmount: 18000, vatAmount: 1800, totalAmount: 19800 });
  });
  it('1시간은 6,600원 그대로 — 7,260원(VAT 별도 착각)이 되면 안 된다', () => {
    expect(computeAmounts(getProduct('practice-room-hourly')!, 1).totalAmount).toBe(6600);
  });
});
