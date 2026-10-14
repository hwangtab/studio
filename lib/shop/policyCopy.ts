import { formatPriceAmount } from '../../data/pricing';
import { formatShipsOn } from './preorder';
import { SHOP_FREE_SHIPPING_FROM, SHOP_SHIPPING_FEE } from '../../data/shop/policy';

/**
 * 상점 배송·교환·환불 안내 문구 — 상품 화면(결제 버튼 위 접힌 규정)과 FAQ가 같은 목록을 쓴다. 금액은 상수에서 만든다.
 * 전자상거래법(청약철회 7일, 불량·오배송은 받은 날부터 3개월·안 날부터 30일)을 따른다. 바꿀 때는 이용약관과 함께 본다.
 */

const won = (n: number) => `${formatPriceAmount(n)}원`;

export const shopShippingNote = (): string =>
  `배송비 ${won(SHOP_SHIPPING_FEE)}, 상품 ${won(SHOP_FREE_SHIPPING_FROM)} 이상이면 무료예요. 국내만 보내요.`;

export const SHOP_REFUND_RULES: readonly string[] = [
  '보내기 전에는 주문 확인 페이지에서 바로 취소할 수 있어요. 결제하신 수단으로 전액 돌려드려요.',
  `받으신 날부터 7일 안에 교환·반품을 요청할 수 있어요. 단순 변심이면 왕복 배송비 ${won(SHOP_SHIPPING_FEE * 2)}을 빼고 돌려드려요.`,
  '음반은 포장(비닐)을 뜯으면 단순 변심으로는 교환·반품할 수 없어요.',
  '상품이 불량이거나 주문과 다르게 왔으면 포장을 뜯었어도 돌려드리고, 배송비도 저희가 내요. 받으신 날부터 3개월, 그 사실을 아신 날부터 30일 안에 알려 주세요.',
  '교환·반품은 카카오톡이나 010-4255-7893으로 요청해 주세요.',
];

/** 예약 판매 공급 시기 — 상세·주문 폼 안내. 섞어 담으면 가장 늦은 날에 함께 보낸다. */
export const shopPreorderSupplyNote = (shipsOn: string): string =>
  `예약 판매 상품이에요. ${formatShipsOn(shipsOn)} 이후에 보내요.`;

export const SHOP_PREORDER_MIX_NOTE = '예약 상품을 다른 상품과 함께 담으면 가장 늦은 발송 예정일에 함께 보내요.';

/** 디지털 상품 청약철회 고지 — 주문 폼·관리 페이지·메일이 같은 문장을 쓴다(전자상거래법 제17조 제2항 제5호). */
export const SHOP_DIGITAL_WITHDRAWAL_NOTICE = '내려받기를 시작하면 청약철회가 제한돼요(전자상거래법 제17조 제2항 제5호).';

/** 디지털 상품 규정 — 주문 폼의 접힌 규정에 실물 규정 대신(또는 함께) 보인다. */
export const SHOP_DIGITAL_RULES: readonly string[] = [
  '디지털 상품은 배송 없이, 결제한 뒤 주문 확인 페이지에서 내려받아요.',
  '내려받기 전에는 주문 확인 페이지에서 바로 취소할 수 있어요. 결제하신 수단으로 전액 돌려드려요.',
  `${SHOP_DIGITAL_WITHDRAWAL_NOTICE} 내려받은 뒤에는 단순 변심으로 취소·환불할 수 없어요.`,
  '파일이 열리지 않거나 설명과 다르면 내려받은 뒤에도 알려 주세요. 확인해서 환불하거나 다시 드려요.',
  '문의는 카카오톡이나 010-4255-7893으로 해 주세요.',
];
