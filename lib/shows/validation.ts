import isEmail from 'validator/lib/isEmail';

import { normalizeKoreanMobile } from '../booking/validation';
import { SHOW_MAX_PER_ORDER_CAP } from './limits';

export interface CreateShowOrderPayload {
  showtimeId: string;
  ticketTypeId: string;
  quantity: number;
  buyerName: string;
  buyerContact: string;
  buyerEmail: string;
}

export type CreateShowOrderValidation = { ok: true; value: CreateShowOrderPayload } | { ok: false; message: string };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * 티켓 주문 생성 요청 검증. 재고·판매창 판정은 createShowOrder의 원자적 게이트가 하고,
 * 여기서는 형식만 거른다 — 환불 규정 동의(refundPolicyAgreed)까지 서버에서 강제한다.
 * 이메일은 선택이지만 적었다면 형식이 맞아야 한다(오타 주소로 티켓 메일이 나가는 것을 막는다).
 */
export function validateCreateShowOrderPayload(body: unknown): CreateShowOrderValidation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: '요청 형식이 올바르지 않습니다.' };
  }
  const b = body as Record<string, unknown>;

  const showtimeId = typeof b.showtimeId === 'string' ? b.showtimeId : '';
  const ticketTypeId = typeof b.ticketTypeId === 'string' ? b.ticketTypeId : '';
  if (!ID_PATTERN.test(showtimeId)) return { ok: false, message: '회차를 선택해 주세요.' };
  if (!ID_PATTERN.test(ticketTypeId)) return { ok: false, message: '티켓 종류를 선택해 주세요.' };

  const quantity = b.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > SHOW_MAX_PER_ORDER_CAP) {
    return { ok: false, message: `매수는 1~${SHOW_MAX_PER_ORDER_CAP}매 사이로 선택해 주세요.` };
  }

  const name = typeof b.buyerName === 'string' ? b.buyerName.trim() : '';
  if (name.length < 2 || name.length > 40) return { ok: false, message: '이름을 확인해 주세요.' };
  const phone = typeof b.buyerContact === 'string' ? normalizeKoreanMobile(b.buyerContact) : null;
  if (!phone) return { ok: false, message: '휴대폰 번호를 확인해 주세요.' };
  const email = typeof b.buyerEmail === 'string' ? b.buyerEmail.trim() : '';
  // 티켓(QR)은 메일로 전달되므로 필수다.
  if (email === '' || email.length > 254 || !isEmail(email)) return { ok: false, message: '이메일을 확인해 주세요.' };

  if (b.refundPolicyAgreed !== true) return { ok: false, message: '환불 규정에 동의해 주세요.' };

  return { ok: true, value: { showtimeId, ticketTypeId, quantity, buyerName: name, buyerContact: phone, buyerEmail: email } };
}
