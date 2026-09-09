import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { orders } from '../../../db/schema';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { sendFundingBankDepositEmails } from '../../../lib/funding/email';
import { getFundingProject } from '../../../lib/funding/projects';
import { createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { TOSS_HOLD_SECONDS } from '../../../lib/funding/policy';
import { validateCreatePledgePayload } from '../../../lib/funding/validation';

/** 시간당 IP별 후원 생성 시도 상한. 위저드 재시도·가족 단위 후원을 감안해 넉넉히 둔다. */
const FUNDING_CREATE_LIMIT = 20;
/** 한 IP가 동시에 열어 둘 수 있는 한정 리워드 토스 홀드 수. */
const MAX_OPEN_HOLDS_PER_IP = 3;
const TOO_MANY_HOLDS_MESSAGE = '결제 대기 중인 후원이 너무 많습니다. 15분 뒤 다시 시도해 주세요.';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const ip = getClientIp(req) ?? 'unknown';

  // 검증을 먼저 한다 — 예전엔 rate limit을 먼저 소비해서, 폼 유효성 오류(400)만 반복해도
  // 시간당 한도가 닳아 정작 제대로 채운 제출이 429로 막혔다. 카운터는 실제로 주문을 만들
  // 자격이 있는 요청에만 쓴다.
  const now = new Date();
  const slug = typeof req.body?.projectSlug === 'string' ? req.body.projectSlug : '';
  const project = getFundingProject(slug);
  const validated = validateCreatePledgePayload(req.body, project, now);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  if (!(await consumeRateLimit(`funding_create:ip:${ip}`, FUNDING_CREATE_LIMIT, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  // 한정 리워드 + 토스 결제에만 별도의 홀드 카운터를 둔다. 이메일·전화를 매번 바꾸면
  // 고객 단위 상한(MAX_OPEN_HOLDS_PER_CUSTOMER)을 우회할 수 있는데, 홀드 창과 같은 길이의
  // IP 카운터면 "동시에 살아 있는 홀드 3개"와 사실상 같은 제한이 된다.
  const limitedReward = validated.reward.totalQuantity !== null;
  if (validated.value.paymentMethod === 'toss' && limitedReward) {
    if (!(await consumeRateLimit(`funding_hold:ip:${ip}`, MAX_OPEN_HOLDS_PER_IP, TOSS_HOLD_SECONDS)))
      return res.status(429).json({ ok: false, code: 'too_many_holds', message: TOO_MANY_HOLDS_MESSAGE });
  }

  await expireStalePledges(now);
  const result = await createFundingPledge(validated.value, project!, validated.reward, now);
  if (!result.ok && result.code === 'too_many_holds')
    return res.status(429).json({ ok: false, code: result.code, message: TOO_MANY_HOLDS_MESSAGE });
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: '남은 수량보다 많이 신청했거나 방금 마감되었습니다. 수량을 줄이거나 다른 리워드를 선택해 주세요.' });

  let depositUrl: string | undefined;
  let emailSent = false;
  if (validated.value.paymentMethod === 'bank_transfer') {
    depositUrl = `/ko/funding/deposit/${result.orderNo}?token=${result.manageToken}`;
    const order = await findFundingOrderByOrderNo(result.orderNo);
    if (order) {
      let emailError: string | null = null;
      try {
        emailError = await sendFundingBankDepositEmails(order, project!);
      } catch (error) {
        console.error('[funding-pledges] 무통장 안내 메일 발송 중 예외', { orderId: order.id, error });
        emailError = error instanceof Error ? error.message : String(error);
      }
      emailSent = !emailError;
      try {
        await getDb().update(orders).set({ notificationError: emailError }).where(eq(orders.id, order.id));
      } catch (error) {
        console.error('[funding-pledges] notificationError 기록 실패', { orderId: order.id, emailError, error });
      }
    }
  }
  return res.status(201).json({
    ok: true, orderNo: result.orderNo, paymentMethod: validated.value.paymentMethod,
    holdExpiresAt: result.holdExpiresAt.toISOString(), ...result.amounts, ...(depositUrl ? { depositUrl, emailSent } : {}),
  });
}
