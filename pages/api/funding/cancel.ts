import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { cancelFundingPledge } from '../../../lib/funding/cancel';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';

/**
 * 입금 전 무통장 신청의 **셀프 해제**.
 *
 * `cancelFundingPledge`는 `paid`만 받는다(환불이 따라야 하는 취소다). 그런데 무통장 pending은
 * 돈이 오간 적이 없는데도 12시간 홀드를 문다. 같은 이메일+전화로 세 번째 무통장 신청은
 * `MAX_OPEN_HOLDS_PER_CUSTOMER`에 막히고(lib/funding/service.ts), 후원자가 스스로 풀 방법이
 * 없어 12시간을 기다려야 했다 — 한정 리워드 재고도 그동안 묶인다.
 *
 * 그래서 만료와 **똑같은 전이**(pending → expired)를 열어 준다. 재고 집계·홀드 카운트가
 * 모두 `status = 'pending'`만 세므로, expired가 되는 순간 재고와 홀드가 함께 풀린다.
 * `status = 'pending'` 조건을 WHERE에 남겨 동시 입금 확인(bank-transfer.ts의 claim)과
 * 경합해도 한쪽만 성공하게 한다.
 */
const expirePendingBankTransfer = async (orderId: string): Promise<boolean> => {
  const result = await getDb().run(
    sql`UPDATE orders SET status = 'expired', updated_at = unixepoch() WHERE id = ${orderId} AND status = 'pending'`,
  );
  return Number(result.rowsAffected) > 0;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_cancel:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  const { orderNo, token } = (typeof req.body === 'object' && req.body) || {};
  if (typeof orderNo !== 'string' || typeof token !== 'string' || !orderNo || !token)
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order || !isTokenMatch(order.manageToken, token)) return res.status(404).json({ ok: false, message: '후원을 찾을 수 없습니다.' });

  // 입금 전 무통장 신청은 환불할 돈이 없다 — 만료와 같은 전이로 끝낸다(위 주석).
  if (order.status === 'pending' && order.fundingPledge?.paymentMethod === 'bank_transfer') {
    if (!(await expirePendingBankTransfer(order.id)))
      return res.status(409).json({ ok: false, code: 'invalid_state', message: '이미 처리된 신청입니다. 새로고침해 주세요.' });
    return res.status(200).json({ ok: true, mode: 'pending_released' });
  }

  const result = await cancelFundingPledge({ orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: new Date() });
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: result.message });
  return res.status(200).json({ ok: true, mode: result.mode, refundAmount: result.refundAmount });
}
