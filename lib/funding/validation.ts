import isEmail from 'validator/lib/isEmail';

import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY, PLEDGE_TEXT_LIMITS } from './policy';
import { computeProjectState, findReward, type FundingProject, type FundingReward } from './projects';

export interface PledgeShipping { name: string; phone: string; postcode: string; address1: string; address2?: string; memo?: string }
export interface CreatePledgePayload {
  projectSlug: string; rewardId: string; quantity: number; additionalAmount: number;
  /** 토스 결제위젯만 쓴다 — 무통장입금은 2026-09-11에 중단했다(lib/funding/policy.ts 참조). */
  paymentMethod: 'toss';
  customerName: string; customerPhone: string; customerEmail: string;
  supporterMessage?: string; displayNamePublic: boolean; shipping?: PledgeShipping; termsAgreed: true;
}
type Result = { ok: true; value: CreatePledgePayload; reward: FundingReward } | { ok: false; message: string };

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' && v.trim().length <= max ? v.trim() : null;

/**
 * 상한을 넘은 칸이 있으면 그 칸의 안내 문구를, 없으면 null.
 *
 * **상한 초과는 거부한다 — 잘라 담거나 버리지 않는다.** 예전에는 text()가 초과 시 null을
 * 돌려주고 선택 필드의 `?? undefined`가 그것을 삼켜서, 201 성공 응답을 받고도 값만
 * 사라졌다. 사라지는 것이 배송 메모(경비실에 맡겨 주세요 같은 지시)라 개설자는 그런 지시가
 * 있었다는 사실 자체를 모른다. 빈 값은 여전히 허용한다 — 여기서 보는 것은 길이뿐이다.
 */
const overLimitMessage = (entries: { value: unknown; max: number; label: string }[]): string | null => {
  for (const e of entries) {
    if (typeof e.value === 'string' && e.value.trim().length > e.max) {
      return `${e.label} ${e.max}자까지 입력할 수 있습니다.`;
    }
  }
  return null;
};

export const validateCreatePledgePayload = (body: unknown, project: FundingProject | null, now: Date): Result => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, message: '요청 형식이 올바르지 않습니다.' };
  const b = body as Record<string, unknown>;
  if (!project) return { ok: false, message: '프로젝트를 찾을 수 없습니다.' };
  if (computeProjectState(project, now) !== 'live') return { ok: false, message: '지금은 펀딩을 받지 않는 프로젝트입니다.' };
  const reward = typeof b.rewardId === 'string' ? findReward(project, b.rewardId) : undefined;
  if (!reward) return { ok: false, message: '리워드를 찾을 수 없습니다.' };
  const quantity = b.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
    return { ok: false, message: `수량은 1~${MAX_QUANTITY} 사이여야 합니다.` };
  const additionalAmount = b.additionalAmount ?? 0;
  if (typeof additionalAmount !== 'number' || !Number.isInteger(additionalAmount) || additionalAmount < 0
    || additionalAmount > MAX_ADDITIONAL_AMOUNT || additionalAmount % ADDITIONAL_AMOUNT_STEP !== 0)
    return { ok: false, message: '추가 펀딩 금액은 1,000원 단위로 500만원까지 가능합니다.' };
  // 무통장입금은 중단했다. 예전 클라이언트나 손으로 만든 요청이 'bank_transfer'를 보내도
  // 여기서 끊는다 — 받아들이면 운영자가 입금을 손으로 대조해야 하는 주문이 다시 생긴다.
  if (b.paymentMethod !== 'toss') return { ok: false, message: '결제수단을 선택해 주세요.' };
  const tooLong = overLimitMessage([
    { value: b.customerName, max: PLEDGE_TEXT_LIMITS.customerName, label: '이름은' },
    { value: b.customerPhone, max: PLEDGE_TEXT_LIMITS.customerPhone, label: '연락처는' },
    { value: b.supporterMessage, max: PLEDGE_TEXT_LIMITS.supporterMessage, label: '응원 메시지는' },
  ]);
  if (tooLong) return { ok: false, message: tooLong };
  const customerName = text(b.customerName, PLEDGE_TEXT_LIMITS.customerName);
  const customerPhone = text(b.customerPhone, PLEDGE_TEXT_LIMITS.customerPhone);
  const customerEmail = typeof b.customerEmail === 'string' && isEmail(b.customerEmail.trim()) ? b.customerEmail.trim() : null;
  if (!customerName || !customerPhone || !customerEmail) return { ok: false, message: '이름·연락처·이메일을 확인해 주세요.' };
  if (b.termsAgreed !== true) return { ok: false, message: '약관에 동의해 주세요.' };
  let shipping: PledgeShipping | undefined;
  if (reward.requiresShipping) {
    // 배열은 typeof 'object'라 그대로 통과하면 인덱스 접근으로 빈 값이 된다 — 제외한다.
    const s = (typeof b.shipping === 'object' && b.shipping !== null && !Array.isArray(b.shipping) ? b.shipping : {}) as Record<string, unknown>;
    const shipTooLong = overLimitMessage([
      { value: s.name, max: PLEDGE_TEXT_LIMITS.shippingName, label: '받는 분 이름은' },
      { value: s.phone, max: PLEDGE_TEXT_LIMITS.shippingPhone, label: '받는 분 연락처는' },
      { value: s.postcode, max: PLEDGE_TEXT_LIMITS.shippingPostcode, label: '우편번호는' },
      { value: s.address1, max: PLEDGE_TEXT_LIMITS.shippingAddress1, label: '주소는' },
      { value: s.address2, max: PLEDGE_TEXT_LIMITS.shippingAddress2, label: '상세주소는' },
      { value: s.memo, max: PLEDGE_TEXT_LIMITS.shippingMemo, label: '배송 메모는' },
    ]);
    if (shipTooLong) return { ok: false, message: shipTooLong };
    const name = text(s.name, PLEDGE_TEXT_LIMITS.shippingName), phone = text(s.phone, PLEDGE_TEXT_LIMITS.shippingPhone),
      postcode = text(s.postcode, PLEDGE_TEXT_LIMITS.shippingPostcode), address1 = text(s.address1, PLEDGE_TEXT_LIMITS.shippingAddress1);
    if (!name || !phone || !postcode || !address1) return { ok: false, message: '배송지를 모두 입력해 주세요.' };
    shipping = {
      name, phone, postcode, address1,
      address2: text(s.address2, PLEDGE_TEXT_LIMITS.shippingAddress2) ?? undefined,
      memo: text(s.memo, PLEDGE_TEXT_LIMITS.shippingMemo) ?? undefined,
    };
  }
  const supporterMessage = text(b.supporterMessage, PLEDGE_TEXT_LIMITS.supporterMessage) ?? undefined;
  return {
    ok: true, reward,
    value: {
      projectSlug: project.slug, rewardId: reward.id, quantity, additionalAmount, paymentMethod: b.paymentMethod,
      customerName, customerPhone, customerEmail, supporterMessage, displayNamePublic: b.displayNamePublic === true,
      shipping, termsAgreed: true,
    },
  };
};
