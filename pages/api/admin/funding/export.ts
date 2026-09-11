import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { listFundingOrdersForExport } from '../../../../lib/funding/admin-list';
import { hasReviewMarker } from '../../../../lib/funding/admin-serialize';
import { toCsv } from '../../../../lib/funding/csv';
import { isRefundPendingStatus } from '../../../../lib/funding/policy';

/**
 * shipHold는 사람이 읽는 칸이다. refundRequestedAt만으로는 부족하다 — 주소로 정렬해
 * 라벨을 뽑는 실무에서 ISO 타임스탬프 한 칸은 눈에 안 들어온다. 값은 "발송금지" 아니면
 * 빈 칸이라, 엑셀에서 이 열만 훑거나 정렬하면 한 번에 걸러진다. 맨 앞(주문번호 다음)에
 * 두는 것도 같은 이유다.
 *
 * refundRequestedAt은 status 바로 옆에 둔다 — 무통장 청약철회는 orders.status가 paid로
 * 남은 채 이 컬럼만 찍히므로(자동 환불이 불가능해 운영자가 계좌로 보내야 한다), 이 값이
 * 빠진 CSV는 **취소를 요청한 사람을 발송 목록에 그대로 싣는다.** adminMemo도 같은 이유로
 * 싣는다 — 웹훅이 남긴 '재고 확인 필요' 같은 메모가 발송 실무 화면 어디에도 안 보였다.
 *
 * needsReview도 shipHold와 같은 판단이다. adminMemo는 맨 끝 칸의 긴 자유 텍스트라
 * 스크롤해야 보이고, 여러 줄이 append로 쌓이면 표식이 그 안에 묻힌다. 사람이 훑거나
 * 정렬할 수 있는 한 칸을 앞쪽에 따로 둔다.
 */
const COLUMNS = [
  'orderNo', 'shipHold', 'needsReview', 'status', 'refundRequestedAt', 'paymentMethod', 'customerName', 'customerPhone', 'customerEmail',
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
      // 청약철회했는데 돈이 아직 안 나간 건. 환불이 끝난 건(refunded)은 애초에 이 조회에
      // 들어오지 않지만, 판정은 화면·헬스체크와 같은 헬퍼를 쓴다.
      shipHold: p.refundRequestedAt && isRefundPendingStatus(o.status) ? '발송금지' : '',
      // 웹훅이 만료·failed 주문을 되살려 확정한 건 — 한정 리워드 재고를 초과했을 수 있다.
      needsReview: hasReviewMarker(p.adminMemo) ? '재고확인' : '',
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
