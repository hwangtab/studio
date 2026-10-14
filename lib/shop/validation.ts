import { normalizeKoreanMobile, validateCustomerContact } from '../booking/validation';
import { SHOP_MAX_LINES, SHOP_MAX_QTY_PER_LINE, SHOP_TEXT_LIMITS } from '../../data/shop/policy';

export { SHOP_TEXT_LIMITS };

/**
 * 상점 주문 생성 요청 검증 — 모양·길이만 본다. 상품이 실제로 팔리는지(공개·재고)는 서비스(lib/shop/service.ts)가
 * 카탈로그와 DB로 다시 판정한다.
 */


export interface ShopLineInput {
  skuId: string;
  quantity: number;
}

export interface ShopShippingInput {
  recipientName: string;
  recipientPhone: string;
  postcode: string;
  address1: string;
  address2: string | null;
  shippingMemo: string | null;
}

export interface CreateShopOrderPayload {
  lines: ShopLineInput[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  /** 디지털 상품만 담은 주문은 없다(null). 실물이 있는데 없으면 서비스가 `shipping_required`로 거절한다. */
  shipping: ShopShippingInput | null;
}

type Result = { ok: true; value: CreateShopOrderPayload } | { ok: false; message: string };

const textOf = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const validateShipping = (s: Record<string, unknown>): { ok: true; value: ShopShippingInput } | { ok: false; message: string } => {
  const fields: Array<[keyof typeof SHOP_TEXT_LIMITS, string]> = [
    ['recipientName', '받는 분 이름은'], ['recipientPhone', '받는 분 연락처는'], ['postcode', '우편번호는'],
    ['address1', '주소는'], ['address2', '상세주소는'], ['shippingMemo', '배송 메모는'],
  ];
  for (const [key, label] of fields) {
    if (textOf(s[key]).length > SHOP_TEXT_LIMITS[key]) return { ok: false, message: `${label} ${SHOP_TEXT_LIMITS[key]}자까지 적을 수 있어요.` };
  }
  const recipientName = textOf(s.recipientName);
  if (recipientName.length < 2) return { ok: false, message: '받는 분 이름을 확인해 주세요.' };
  const recipientPhone = normalizeKoreanMobile(textOf(s.recipientPhone));
  if (!recipientPhone) return { ok: false, message: '받는 분 휴대폰 번호를 확인해 주세요.' };
  const postcode = textOf(s.postcode);
  if (!/^\d{5}$/.test(postcode)) return { ok: false, message: '우편번호(5자리)를 확인해 주세요.' };
  const address1 = textOf(s.address1);
  if (!address1) return { ok: false, message: '주소를 입력해 주세요.' };

  return {
    ok: true,
    value: { recipientName, recipientPhone, postcode, address1, address2: textOf(s.address2) || null, shippingMemo: textOf(s.shippingMemo) || null },
  };
};

export const validateCreateShopOrderPayload = (body: unknown): Result => {
  if (typeof body !== 'object' || body === null) return { ok: false, message: '잘못된 요청이에요.' };
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.lines) || b.lines.length === 0) return { ok: false, message: '담은 상품이 없어요.' };
  if (b.lines.length > SHOP_MAX_LINES) return { ok: false, message: `한 번에 ${SHOP_MAX_LINES}가지까지 주문할 수 있어요.` };
  const merged = new Map<string, number>();
  for (const raw of b.lines) {
    const line = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const skuId = textOf(line.skuId);
    const quantity = line.quantity;
    if (!skuId || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, message: '수량을 확인해 주세요.' };
    }
    // 같은 SKU가 두 줄로 오면 합친다 — 재고 게이트가 줄마다 따로 돌면 합계가 재고를 넘어도 통과한다.
    merged.set(skuId, (merged.get(skuId) ?? 0) + quantity);
  }
  for (const quantity of merged.values()) {
    if (quantity > SHOP_MAX_QTY_PER_LINE) return { ok: false, message: `한 상품은 ${SHOP_MAX_QTY_PER_LINE}개까지 주문할 수 있어요.` };
  }

  const contact = validateCustomerContact(b);
  if (!contact.ok) return contact;

  const hasShipping = typeof b.shipping === 'object' && b.shipping !== null && !Array.isArray(b.shipping);
  let shipping: ShopShippingInput | null = null;
  if (hasShipping) {
    const checked = validateShipping(b.shipping as Record<string, unknown>);
    if (!checked.ok) return checked;
    shipping = checked.value;
  }

  return {
    ok: true,
    value: {
      lines: [...merged].map(([skuId, quantity]) => ({ skuId, quantity })),
      customerName: contact.value.customerName,
      customerPhone: contact.value.customerPhone,
      customerEmail: contact.value.customerEmail,
      shipping,
    },
  };
};
