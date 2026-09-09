import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { orders } from '../../../db/schema';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { sendFundingBankDepositEmails } from '../../../lib/funding/email';
import { getFundingProject } from '../../../lib/funding/projects';
import { createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { validateCreatePledgePayload } from '../../../lib/funding/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const now = new Date();
  const slug = typeof req.body?.projectSlug === 'string' ? req.body.projectSlug : '';
  const project = getFundingProject(slug);
  const validated = validateCreatePledgePayload(req.body, project, now);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  await expireStalePledges(now);
  const result = await createFundingPledge(validated.value, project!, validated.reward, now);
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: '방금 이 리워드가 마감되었습니다. 다른 리워드를 선택해 주세요.' });

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
