import isEmail from 'validator/lib/isEmail';

import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from './policy';
import { computeProjectState, findReward, type FundingProject, type FundingReward } from './projects';

export interface PledgeShipping { name: string; phone: string; postcode: string; address1: string; address2?: string; memo?: string }
export interface CreatePledgePayload {
  projectSlug: string; rewardId: string; quantity: number; additionalAmount: number;
  paymentMethod: 'toss' | 'bank_transfer';
  customerName: string; customerPhone: string; customerEmail: string;
  supporterMessage?: string; displayNamePublic: boolean; shipping?: PledgeShipping; termsAgreed: true;
}
type Result = { ok: true; value: CreatePledgePayload; reward: FundingReward } | { ok: false; message: string };

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' && v.trim().length <= max ? v.trim() : null;

export const validateCreatePledgePayload = (body: unknown, project: FundingProject | null, now: Date): Result => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, message: '요청 형식이 올바르지 않습니다.' };
  const b = body as Record<string, unknown>;
  if (!project) return { ok: false, message: '프로젝트를 찾을 수 없습니다.' };
  if (computeProjectState(project, now) !== 'live') return { ok: false, message: '지금은 후원을 받지 않는 프로젝트입니다.' };
  const reward = typeof b.rewardId === 'string' ? findReward(project, b.rewardId) : undefined;
  if (!reward) return { ok: false, message: '리워드를 찾을 수 없습니다.' };
  const quantity = b.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
    return { ok: false, message: `수량은 1~${MAX_QUANTITY} 사이여야 합니다.` };
  const additionalAmount = b.additionalAmount ?? 0;
  if (typeof additionalAmount !== 'number' || !Number.isInteger(additionalAmount) || additionalAmount < 0
    || additionalAmount > MAX_ADDITIONAL_AMOUNT || additionalAmount % ADDITIONAL_AMOUNT_STEP !== 0)
    return { ok: false, message: '추가 후원금은 1,000원 단위로 500만원까지 가능합니다.' };
  if (b.paymentMethod !== 'toss' && b.paymentMethod !== 'bank_transfer') return { ok: false, message: '결제수단을 선택해 주세요.' };
  if (b.paymentMethod === 'bank_transfer' && reward.totalQuantity !== null)
    return { ok: false, message: '한정 수량 리워드는 무통장입금으로 후원할 수 없습니다.' };
  const customerName = text(b.customerName, 50);
  const customerPhone = text(b.customerPhone, 30);
  const customerEmail = typeof b.customerEmail === 'string' && isEmail(b.customerEmail.trim()) ? b.customerEmail.trim() : null;
  if (!customerName || !customerPhone || !customerEmail) return { ok: false, message: '이름·연락처·이메일을 확인해 주세요.' };
  if (b.termsAgreed !== true) return { ok: false, message: '약관에 동의해 주세요.' };
  let shipping: PledgeShipping | undefined;
  if (reward.requiresShipping) {
    const s = (typeof b.shipping === 'object' && b.shipping !== null ? b.shipping : {}) as Record<string, unknown>;
    const name = text(s.name, 50), phone = text(s.phone, 30), postcode = text(s.postcode, 10), address1 = text(s.address1, 200);
    if (!name || !phone || !postcode || !address1) return { ok: false, message: '배송지를 모두 입력해 주세요.' };
    shipping = { name, phone, postcode, address1, address2: text(s.address2, 200) ?? undefined, memo: text(s.memo, 200) ?? undefined };
  }
  const supporterMessage = text(b.supporterMessage, 500) ?? undefined;
  return {
    ok: true, reward,
    value: {
      projectSlug: project.slug, rewardId: reward.id, quantity, additionalAmount, paymentMethod: b.paymentMethod,
      customerName, customerPhone, customerEmail, supporterMessage, displayNamePublic: b.displayNamePublic === true,
      shipping, termsAgreed: true,
    },
  };
};
