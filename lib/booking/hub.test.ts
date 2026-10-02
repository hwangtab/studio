import { PRACTICE_ROOM_HOURLY_PRICE_INCL, formatPriceAmount } from '../../data/pricing';
import { BOOKING_HUB_INQUIRY_LINKS, buildBookingHub } from './hub';
import { MIXING_PRODUCTS } from './mixing-products';
import { getProduct } from './products';

const groups = buildBookingHub();
const entries = groups.flatMap((g) => g.entries);

describe('예약 통합 랜딩(/ko/booking) 목록', () => {
  it('모든 링크가 위저드가 받는 서비스·상품을 가리킨다', () => {
    for (const entry of entries) {
      const url = new URL(entry.href, 'https://studionol.co.kr');
      const [, locale, booking, service] = url.pathname.split('/');
      expect([locale, booking]).toEqual(['ko', 'booking']);
      const productId = url.searchParams.get('product');
      expect(productId).toBe(entry.productId);

      if (service === 'mixing-mastering') {
        expect(MIXING_PRODUCTS.some((p) => p.id === productId)).toBe(true);
      } else {
        const product = getProduct(productId as string);
        expect(product?.service).toBe(service);
      }
    }
  });

  it('위저드에 있는 모든 온라인 상품이 랜딩에 있다(운영자 결제 테스트 제외)', () => {
    const ids = new Set(entries.map((e) => e.productId));
    for (const p of MIXING_PRODUCTS) expect(ids.has(p.id)).toBe(true);
    for (const id of ['recording-pro', 'recording-hourly', 'recording-daylock-4h', 'recording-daylock-8h',
      'voice-acting-hourly', 'wedding-song', 'cover-video', 'practice-room-hourly']) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.has('smoke-test')).toBe(false);
  });

  it('보이는 가격이 위저드가 청구하는 단가와 같다', () => {
    for (const entry of entries) {
      const product = getProduct(entry.productId);
      if (!product) continue; // 믹싱은 아래에서
      if (product.id === 'practice-room-hourly') {
        // 소비자가(VAT 포함)로 보여 준다 — 위저드의 unitAmount는 공급가다.
        expect(entry.price).toBe(`${formatPriceAmount(PRACTICE_ROOM_HOURLY_PRICE_INCL)}원`);
      } else {
        expect(entry.price).toBe(`${formatPriceAmount(product.unitAmount)}원`);
      }
    }
    for (const p of MIXING_PRODUCTS) {
      expect(entries.find((e) => e.productId === p.id)?.price).toBe(`${formatPriceAmount(p.unitAmount)}원`);
    }
  });

  it('부가세 포함 표기는 연습실 시간제 그룹 하나뿐이다', () => {
    const vatIncluded = groups.filter((g) => g.priceNote.includes('부가세 포함')).map((g) => g.id);
    expect(vatIncluded).toEqual(['practice-room']);
  });

  it('문의형 링크는 전부 ko 경로다', () => {
    for (const link of BOOKING_HUB_INQUIRY_LINKS) expect(link.href.startsWith('/ko/')).toBe(true);
  });
});
