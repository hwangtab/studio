import type { NextApiRequest, NextApiResponse } from 'next';

import { findFundingOrderById } from '../../../../../../lib/funding/service';
import { handleRefundAccountView } from '../../../../../../lib/payments/refundAccountView';

/**
 * GET — 계좌 입금 후원자가 적은 **환불 계좌**를 응답으로만 내보낸다(마이그레이션 0048).
 *
 * 본체는 결제 공용 `handleRefundAccountView`다 — 공연·예약·믹싱(`/api/admin/orders/[id]/refund-account`)과
 * 같은 규칙(no-store, 접속기록 `refund_account_view`, 예금주≠후원자 경고)을 한 곳에서 지킨다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await handleRefundAccountView(
    req,
    res,
    async (id) => {
      const order = await findFundingOrderById(id);
      if (!order?.fundingPledge) return null;
      return { key: { kind: 'funding', orderNo: order.orderNo }, customerName: order.customerName };
    },
    'funding',
  );
}
