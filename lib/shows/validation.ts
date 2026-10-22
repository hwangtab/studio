import { normalizeKrOrIntlPhone } from '../contact/phone';
import { contactProblems } from '../contact/rules';
import type { ShowLocale } from './i18n';
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
 * 연락처 — 한국 휴대폰이면 010-0000-0000으로 맞추고, 아니면 국가번호(+)로 시작하는 해외 번호를 받는다
 * (영어 화면을 연 2026-10-07부터 — 해외에서 온 관객은 한국 번호가 없다). 문자 발송에 쓰지 않고 운영자가
 * 연락할 때만 쓴다. 해외 번호는 `+` 뒤 숫자 7~15자리(E.164 상한)를 `+<숫자>`로 저장한다.
 */
export const normalizeShowContact = normalizeKrOrIntlPhone;

const MESSAGES = {
  ko: {
    body: '요청 형식이 올바르지 않아요.',
    showtime: '회차를 선택해 주세요.',
    ticketType: '티켓 종류를 선택해 주세요.',
    quantity: (max: number) => `매수는 1~${max}매 사이로 선택해 주세요.`,
    name: '이름을 확인해 주세요.',
    phone: '휴대폰 번호를 확인해 주세요.',
    email: '이메일을 확인해 주세요.',
    agree: '환불 규정에 동의해 주세요.',
  },
  en: {
    body: 'The request is not in the expected format.',
    showtime: 'Please choose a showtime.',
    ticketType: 'Please choose a ticket type.',
    quantity: (max: number) => `Please choose between 1 and ${max} tickets.`,
    name: 'Please check your name.',
    phone: 'Please check your phone number. Use a Korean mobile number or include the country code (e.g. +1 …).',
    email: 'Please check your email address.',
    agree: 'Please agree to the refund policy.',
  },
} as const;

/**
 * 티켓 주문 생성 요청 검증. 재고·판매창 판정은 createShowOrder의 원자적 게이트가 하고,
 * 여기서는 형식만 거른다 — 환불 규정 동의(refundPolicyAgreed)까지 서버에서 강제한다.
 * 이메일은 선택이지만 적었다면 형식이 맞아야 한다(오타 주소로 티켓 메일이 나가는 것을 막는다).
 */
export function validateCreateShowOrderPayload(body: unknown, locale: ShowLocale = 'ko'): CreateShowOrderValidation {
  const m = MESSAGES[locale];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: m.body };
  }
  const b = body as Record<string, unknown>;

  const showtimeId = typeof b.showtimeId === 'string' ? b.showtimeId : '';
  const ticketTypeId = typeof b.ticketTypeId === 'string' ? b.ticketTypeId : '';
  if (!ID_PATTERN.test(showtimeId)) return { ok: false, message: m.showtime };
  if (!ID_PATTERN.test(ticketTypeId)) return { ok: false, message: m.ticketType };

  const quantity = b.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > SHOW_MAX_PER_ORDER_CAP) {
    return { ok: false, message: m.quantity(SHOW_MAX_PER_ORDER_CAP) };
  }

  // 판정은 lib/contact/rules.ts(해외 번호 허용 'kr-or-intl') — 예매 화면의 칸별 검사와 같은 규칙. 티켓(QR)은 메일로 가므로 이메일은 필수다.
  const rawName = typeof b.buyerName === 'string' ? b.buyerName : '';
  const rawContact = typeof b.buyerContact === 'string' ? b.buyerContact : '';
  const rawEmail = typeof b.buyerEmail === 'string' ? b.buyerEmail : '';
  const [problem] = contactProblems({ customerName: rawName, customerPhone: rawContact, customerEmail: rawEmail }, 'kr-or-intl');
  if (problem) return { ok: false, message: problem.field === 'customerName' ? m.name : problem.field === 'customerPhone' ? m.phone : m.email };
  const name = rawName.trim();
  const phone = normalizeShowContact(rawContact) as string;
  const email = rawEmail.trim();

  if (b.refundPolicyAgreed !== true) return { ok: false, message: m.agree };

  return { ok: true, value: { showtimeId, ticketTypeId, quantity, buyerName: name, buyerContact: phone, buyerEmail: email } };
}
