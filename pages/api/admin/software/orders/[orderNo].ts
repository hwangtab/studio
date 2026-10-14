import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { cancelSoftwareOrder } from '../../../../../lib/software/cancel';
import { normalizeSoftwareOrderNo } from '../../../../../lib/software/order';

/** 관리자 — 소프트웨어 주문 전액 환불(활성화 뒤에도 된다: 하자·분쟁 대응). 라이선스는 `refunded`가 되어 새 기기를 받지 않는다. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const orderNo = normalizeSoftwareOrderNo(req.query.orderNo);
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  if (!orderNo || b.action !== 'refund') return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });

  const result = await cancelSoftwareOrder({ orderNo, requestedBy: 'admin', reason: `관리자 환불 · ${auth.actor}`, now: new Date() });
  if (!result.ok) return res.status(result.code === 'recording_failed' ? 202 : 409).json({ ok: false, code: result.code, message: result.message });
  return res.status(200).json({ ok: true, refundAmount: result.refundAmount });
}
