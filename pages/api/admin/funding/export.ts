import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { listFundingOrdersForExport } from '../../../../lib/funding/admin-list';
import { toCsv } from '../../../../lib/funding/csv';

/**
 * refundRequestedAt은 status 바로 옆에 둔다 — 무통장 청약철회는 orders.status가 paid로
 * 남은 채 이 컬럼만 찍히므로(자동 환불이 불가능해 운영자가 계좌로 보내야 한다), 이 값이
 * 빠진 CSV는 **취소를 요청한 사람을 발송 목록에 그대로 싣는다.** adminMemo도 같은 이유로
 * 싣는다 — 웹훅이 남긴 '재고 확인 필요' 같은 메모가 발송 실무 화면 어디에도 안 보였다.
 */
const COLUMNS = [
  'orderNo', 'status', 'refundRequestedAt', 'paymentMethod', 'customerName', 'customerPhone', 'customerEmail',
  'rewardTitle', 'quantity', 'additionalAmount', 'totalAmount',
  'shippingName', 'shippingPhone', 'shippingPostcode', 'shippingAddress1', 'shippingAddress2', 'shippingMemo',
  'fulfillmentStatus', 'trackingCompany', 'trackingNumber', 'supporterMessage', 'paidAt', 'adminMemo',
];

/** 프로젝트 slug는 파일명(Content-Disposition)에 그대로 들어가므로 형식을 먼저 검증한다. */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * 개인정보(연락처·배송지)가 실리는 다운로드라 확정 건(paid·partially_refunded)만,
 * 관리자 세션 필수, no-store. 건수 상한은 두지 않는다 — 발송 실무용 전량 다운로드다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false });
  const slug = typeof req.query.slug === 'string' && req.query.slug ? req.query.slug : null;
  if (slug !== null && !SLUG_PATTERN.test(slug)) {
    return res.status(400).json({ ok: false, message: '프로젝트 slug 형식이 올바르지 않습니다.' });
  }
  const items = await listFundingOrdersForExport(slug);
  const rows = items.map((o) => {
    const p = o.fundingPledge!;
    return {
      orderNo: o.orderNo,
      status: o.status,
      refundRequestedAt: p.refundRequestedAt?.toISOString() ?? null,
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
      trackingCompany: p.trackingCompany,
      trackingNumber: p.trackingNumber,
      supporterMessage: p.supporterMessage,
      paidAt: p.paidAt?.toISOString() ?? null,
      adminMemo: p.adminMemo,
    };
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="funding-${slug ?? 'all'}.csv"`);
  return res.status(200).send(toCsv(rows, COLUMNS));
}
