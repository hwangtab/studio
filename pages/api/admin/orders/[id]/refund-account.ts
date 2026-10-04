import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { refundAccountKindOf } from '../../../../../lib/payments/bankDeposit';
import { handleRefundAccountView } from '../../../../../lib/payments/refundAccountView';

/**
 * GET — 공연 티켓·연습실/녹음 예약·믹싱 주문의 **환불 계좌**를 응답으로만 내보낸다(관리자 "계좌 보기").
 *
 * 세 도메인 모두 `orders` 행이 있어 주문 id 하나로 찾는다(공연 주문도 `orders.order_no`를 공유한다).
 * 규칙은 결제 공용 `handleRefundAccountView` — no-store, 접속기록 `refund_account_view`, 계좌번호는
 * props에 싣지 않는다. 펀딩은 자기 경로(`/api/admin/funding/pledges/[id]/refund-account`)를 쓴다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await handleRefundAccountView(
    req,
    res,
    async (id) => {
      const order = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.id, id) });
      const kind = order ? refundAccountKindOf(order.type) : null;
      if (!order || !kind || kind === 'funding') return null;
      return { key: { kind, orderNo: order.orderNo }, customerName: order.customerName };
    },
    'orders',
  );
}
