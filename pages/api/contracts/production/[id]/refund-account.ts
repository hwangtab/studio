import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { loadRefundAccountSummary, markRefundAccountRefunded } from '../../../../../lib/payments/refundAccount';
import { handleRefundAccountView } from '../../../../../lib/payments/refundAccountView';
import { recordContractBankLinkRefunds } from '../../../../../lib/contracts/production/refund-execute';

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
  // 기록이 실패했는데 ok를 돌려주면 새로고침해도 버튼이 그대로라 운영자가 이중 송금할 수 있다.
  const recorded = await markRefundAccountRefunded(key, new Date());
  if (!recorded) return res.status(500).json({ ok: false, message: '송금 완료를 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  // 결제 링크 계좌 입금으로 받은 몫은 그 주문의 환불로도 남긴다 — 매출이 결제 행으로 세는 돈이라, 안 남기면 돌려준 돈이
  // 매출에 그대로 남는다(refund-execute.ts). 실패해도 송금 완료 기록은 되돌리지 않고 알린다(다시 누르면 남은 만큼만 기록한다).
  const { failed } = await recordContractBankLinkRefunds(id);
  if (failed.length > 0) {
    return res.status(200).json({ ok: true, message: `송금 완료는 기록했지만 결제 링크 주문 ${failed.join(', ')}의 환불 기록을 남기지 못했습니다. 예약 목록의 그 주문에서 환불 기록을 확인해 주세요.` });
  }
  return res.status(200).json({ ok: true });
}
