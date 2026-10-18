import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { loadRefundAccountSummary, markRefundAccountRefunded } from '../../../../../lib/payments/refundAccount';
import { handleRefundAccountView } from '../../../../../lib/payments/refundAccountView';

/**
 * 제작 계약 해지 환불 계좌(관리자).
 *
 * - GET: 의뢰인이 진행 페이지에 적은 환불 계좌를 응답으로만 내보낸다. 본체는 결제 공용 handleRefundAccountView —
 *   펀딩·예약·공연과 같은 규칙(no-store, 접속기록 refund_account_view, 예금주≠의뢰인 경고)을 한 곳에서 지킨다.
 *   키는 (production, 계약 id)다.
 * - POST: 송금을 마쳤다고 기록한다(refunded_at).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    await handleRefundAccountView(
      req,
      res,
      async (id) => {
        const contract = await getDb().query.productionContracts.findFirst({
          where: (t, { eq }) => eq(t.id, id),
          columns: { id: true, clientName: true },
        });
        return contract ? { key: { kind: 'production', orderNo: contract.id }, customerName: contract.clientName } : null;
      },
      'production',
    );
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false });
  }
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
  const key = { kind: 'production', orderNo: id } as const;
  const summary = await loadRefundAccountSummary(key);
  if (summary.status !== 'present') return res.status(409).json({ ok: false, message: '접수된 환불 계좌가 없어요.' });
  if (summary.refundedAt) return res.status(409).json({ ok: false, message: '이미 송금 완료로 기록했어요.' });
  await markRefundAccountRefunded(key, new Date());
  return res.status(200).json({ ok: true });
}
