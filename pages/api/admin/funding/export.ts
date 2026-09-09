import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { listFundingOrders } from '../../../../lib/funding/admin-list';
import { toCsv } from '../../../../lib/funding/csv';

const COLUMNS = [
  'orderNo', 'status', 'paymentMethod', 'customerName', 'customerPhone', 'customerEmail',
  'rewardTitle', 'quantity', 'additionalAmount', 'totalAmount',
  'shippingName', 'shippingPhone', 'shippingPostcode', 'shippingAddress1', 'shippingAddress2', 'shippingMemo',
  'fulfillmentStatus', 'trackingNumber', 'supporterMessage', 'paidAt',
];

/** 개인정보(연락처·배송지)가 실리는 다운로드라 확정(paid) 건만, 관리자 세션 필수, no-store. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false });
  const slug = typeof req.query.slug === 'string' ? req.query.slug : null;
  const items = (await listFundingOrders(slug)).filter((o) => o.status === 'paid');
  const rows = items.map((o) => {
    const p = o.fundingPledge!;
    return {
      orderNo: o.orderNo,
      status: o.status,
      paymentMethod: p.paymentMethod,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerEmail: o.customerEmail,
      rewardTitle: p.rewardTitle,
      quantity: p.quantity,
      additionalAmount: p.additionalAmount,
      totalAmount: o.totalAmount,
      shippingName: p.shippingName,
      shippingPhone: p.shippingPhone,
      shippingPostcode: p.shippingPostcode,
      shippingAddress1: p.shippingAddress1,
      shippingAddress2: p.shippingAddress2,
      shippingMemo: p.shippingMemo,
      fulfillmentStatus: p.fulfillmentStatus,
      trackingNumber: p.trackingNumber,
      supporterMessage: p.supporterMessage,
      paidAt: p.paidAt?.toISOString() ?? null,
    };
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="funding-${slug ?? 'all'}.csv"`);
  return res.status(200).send(toCsv(rows, COLUMNS));
}
