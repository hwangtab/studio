import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { cancelAwaitingShopDeposit, confirmShopBankDeposit, deliverShopDepositGuide } from '../../../../../lib/shop/bankDeposit';
import { cancelShopOrder } from '../../../../../lib/shop/cancel';
import { markShopOrderDelivered, markShopOrderShipped } from '../../../../../lib/shop/fulfillment';
import { normalizeShopOrderNo } from '../../../../../lib/shop/shape';

/**
 * 관리자 상점 주문 액션 — `ship`(택배사·운송장, 고쳐 적기 포함) · `deliver` · `refund`(전액, 발송 뒤 반품 포함).
 * 계좌 입금 주문: `confirm_deposit`(입금 확인 — 확정) · `cancel_deposit`(미입금 취소) · `resend_deposit_guide`(입금 안내 재발송).
 * 계좌 입금으로 확정된 주문의 `refund`는 토스를 부르지 않고 기록만 남긴다 — 운영자가 이미 고객 계좌로 송금한 뒤에 누른다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const orderNo = normalizeShopOrderNo(req.query.orderNo);
  if (!orderNo) return res.status(400).json({ ok: false, message: '주문번호 형식이 아니에요.' });
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;

  if (b.action === 'ship') {
    const result = await markShopOrderShipped({
      orderNo,
      courier: typeof b.courier === 'string' ? b.courier : '',
      trackingNumber: typeof b.trackingNumber === 'string' ? b.trackingNumber : '',
    });
    return result.ok ? res.status(200).json({ ok: true }) : res.status(409).json(result);
  }
  if (b.action === 'deliver') {
    const result = await markShopOrderDelivered(orderNo);
    return result.ok ? res.status(200).json({ ok: true }) : res.status(409).json(result);
  }
  if (b.action === 'confirm_deposit') {
    const result = await confirmShopBankDeposit({ orderNo, now: new Date() });
    return result.ok ? res.status(200).json({ ok: true }) : res.status(409).json(result);
  }
  if (b.action === 'cancel_deposit') {
    const result = await cancelAwaitingShopDeposit({ orderNo });
    return result.ok ? res.status(200).json({ ok: true }) : res.status(409).json(result);
  }
  if (b.action === 'resend_deposit_guide') {
    const failure = await deliverShopDepositGuide(orderNo);
    if (failure === 'invalid_state') return res.status(409).json({ ok: false, message: '입금 대기 중인 주문이 아니에요.' });
    return failure ? res.status(502).json({ ok: false, message: `메일 발송에 실패했어요(${failure}).` }) : res.status(200).json({ ok: true });
  }
  if (b.action === 'refund') {
    const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim().slice(0, 200) : '관리자 환불';
    const result = await cancelShopOrder({ orderNo, requestedBy: 'admin', reason, now: new Date() });
    if (!result.ok) return res.status(result.code === 'recording_failed' ? 202 : 409).json(result);
    return res.status(200).json({ ok: true, refundAmount: result.refundAmount });
  }
  return res.status(400).json({ ok: false, message: '알 수 없는 작업이에요.' });
}
