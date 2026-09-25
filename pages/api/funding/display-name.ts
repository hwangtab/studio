import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { fundingPledges } from '../../../db/schema';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { isPublicNameStyle, resolvePublicName } from '../../../lib/funding/publicName';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';

/**
 * 후원자 명단 이름 공개 동의의 **철회·재동의** 경로. 명단에 올릴 이름(실명·가린 이름·
 * 닉네임, lib/funding/publicName.ts)도 여기서 바꾼다 — 결제 완료 화면의 "명단에 올리기"도
 * 이 경로를 쓴다.
 *
 * 약관 제13조 2항은 "후원 확인 페이지에서 철회할 수 있다"고 약속하는데, 정작 그 화면에는
 * 공개 여부 표시조차 없었다 — 약관이 있다고 말한 기능이 코드에 없었던 셈이다. 약관 문언은
 * 그대로 두고 구현을 문언에 맞춘다.
 *
 * 인증·응답은 `/api/funding/cancel`과 같은 규칙이다: 관리 토큰 + IP 속도 제한, 그리고
 * **주문 부재와 토큰 불일치를 같은 404**로 돌려준다(주문번호는 비밀이 아니므로, 다르게
 * 답하면 주문의 존재 여부를 떠볼 수 있다).
 */

/** 이름이 공개되거나 앞으로 공개될 수 있는 상태에서만 바꾼다. */
const EDITABLE_STATUSES = new Set([
  // 아직 결제 전이지만 확정되면 그대로 반영된다 — 이때 철회를 막으면 이름이 나중에 뜬다.
  'pending',
  // 실제로 명단에 이름이 떠 있는 상태(aggregateProjectStatus는 이 둘만 공개 명단에 싣는다).
  'paid',
  'partially_refunded',
]);

const NOT_FOUND = { ok: false, message: '펀딩 내역을 찾을 수 없습니다.' } as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_display_name:ip:${ip}`, 30, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const { orderNo, token, displayNamePublic, publicNameStyle, publicNickname } = (typeof req.body === 'object' && req.body) || {};
  if (typeof orderNo !== 'string' || typeof token !== 'string' || !orderNo || !token || typeof displayNamePublic !== 'boolean')
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  if (publicNameStyle !== undefined && !isPublicNameStyle(publicNameStyle))
    return res.status(400).json({ ok: false, message: '명단 표시 방식을 확인해 주세요.' });

  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order || !isTokenMatch(order.manageToken, token)) return res.status(404).json(NOT_FOUND);
  if (!order.fundingPledge) return res.status(404).json(NOT_FOUND);
  if (!EDITABLE_STATUSES.has(order.status))
    return res.status(409).json({ ok: false, code: 'invalid_state', message: '이 펀딩은 이름 공개 설정을 바꿀 수 없습니다.' });

  /**
   * 표시 이름은 **방식이 함께 왔을 때만** 바꾼다. 방식 없이 공개만 켜는 요청(이 기능 전에
   * 열어 둔 화면)이 표시 이름을 실명으로 되돌리면, 닉네임을 골라 둔 사람이 토글 한 번에
   * 실명으로 공개된다. 공개를 끌 때도 표시 이름은 남긴다 — 다시 켤 때 고른 이름이 유지된다.
   */
  let publicName: string | null | undefined;
  if (publicNameStyle !== undefined && displayNamePublic) {
    const resolved = resolvePublicName(publicNameStyle, order.customerName, typeof publicNickname === 'string' ? publicNickname : undefined);
    if (!resolved.ok) return res.status(400).json({ ok: false, message: resolved.message });
    publicName = resolved.value;
  }

  await getDb()
    .update(fundingPledges)
    .set({ displayNamePublic, ...(publicName !== undefined ? { publicName } : {}), updatedAt: new Date() })
    .where(eq(fundingPledges.orderId, order.id));
  const storedPublicName = publicName !== undefined ? publicName : order.fundingPledge.publicName ?? null;
  return res.status(200).json({ ok: true, displayNamePublic, publicName: storedPublicName });
}
