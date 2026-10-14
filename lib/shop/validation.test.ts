import { validateCreateShopOrderPayload } from './validation';
import { shopPayload } from '../../tests/helpers/shopFixtures';

describe('validateCreateShopOrderPayload', () => {
  it('정상 요청은 통과하고 같은 SKU 두 줄은 합친다(재고 게이트가 줄마다 따로 돌면 초과 판매)', () => {
    const r = validateCreateShopOrderPayload(shopPayload([{ skuId: 'a', quantity: 2 }, { skuId: 'a', quantity: 3 }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lines).toEqual([{ skuId: 'a', quantity: 5 }]);
  });

  it('합친 수량이 한 상품 상한을 넘으면 거절', () => {
    expect(validateCreateShopOrderPayload(shopPayload([{ skuId: 'a', quantity: 6 }, { skuId: 'a', quantity: 6 }])).ok).toBe(false);
  });

  it.each([
    ['빈 줄', shopPayload([])],
    ['수량 0', shopPayload([{ skuId: 'a', quantity: 0 }])],
    ['소수 수량', shopPayload([{ skuId: 'a', quantity: 1.5 }])],
    ['우편번호 형식', shopPayload([{ skuId: 'a', quantity: 1 }], { shipping: { recipientName: '김구매', recipientPhone: '010-1234-5678', postcode: '123', address1: '주소' } })],
    ['받는 분 휴대폰', shopPayload([{ skuId: 'a', quantity: 1 }], { shipping: { recipientName: '김구매', recipientPhone: '02-123-4567', postcode: '03000', address1: '주소' } })],
    ['주소 없음', shopPayload([{ skuId: 'a', quantity: 1 }], { shipping: { recipientName: '김구매', recipientPhone: '010-1234-5678', postcode: '03000', address1: '' } })],
    ['이메일', shopPayload([{ skuId: 'a', quantity: 1 }], { customerEmail: 'x' })],
  ])('%s는 거절', (_label, body) => {
    expect(validateCreateShopOrderPayload(body).ok).toBe(false);
  });

  it('긴 배송 메모는 자르지 않고 거절한다', () => {
    const body = shopPayload([{ skuId: 'a', quantity: 1 }], {
      shipping: { recipientName: '김구매', recipientPhone: '010-1234-5678', postcode: '03000', address1: '주소', shippingMemo: 'x'.repeat(201) },
    });
    const r = validateCreateShopOrderPayload(body);
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining('배송 메모') });
  });

  it('배송지는 선택이다 — 없으면 null(실물 여부는 서비스가 판정), 있으면 전부 검증한다', () => {
    const none = validateCreateShopOrderPayload(shopPayload([{ skuId: 'a', quantity: 1 }], { shipping: undefined }));
    expect(none.ok && none.value.shipping).toBeNull();
    const partial = validateCreateShopOrderPayload(shopPayload([{ skuId: 'a', quantity: 1 }], { shipping: { recipientName: '김구매' } }));
    expect(partial.ok).toBe(false);
  });
});
