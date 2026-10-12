import { draftStorageKey } from '../formDraft';

/**
 * 상품 주문 폼의 입력 초안(이름·연락처·주소) 저장 키 — 폼이 쓰고, 결제 완료 화면이 지운다.
 * 결제창을 닫고 돌아오면 그대로 남아 있어야 하므로 폼은 지우지 않는다.
 */
export const SHOP_DRAFT_KEY = draftStorageKey('shop', 'order');
