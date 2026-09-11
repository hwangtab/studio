import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { fulfillmentStatusEnum, fundingPledges, orders } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { REVIEW_CLEARED_MARKER, hasReviewMarker } from '../../../../../lib/funding/admin-serialize';
import { confirmBankDeposit } from '../../../../../lib/funding/bank-transfer';
import { cancelFundingPledge } from '../../../../../lib/funding/cancel';
import { sendFundingBankDepositEmails, sendFundingConfirmedEmails, sendFundingRefundRequestClearedEmails } from '../../../../../lib/funding/email';
import { isRefundPendingStatus } from '../../../../../lib/funding/policy';
import { getFundingProject } from '../../../../../lib/funding/projects';
import { MANUAL_PLACEHOLDER_EMAIL, findFundingOrderById } from '../../../../../lib/funding/service';
import { kstDateString } from '../../../../../lib/booking/kst';

const CANCEL_STATUS: Record<string, number> = { not_found: 404, invalid_state: 409, toss_failed: 502, recording_failed: 500 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });
  const id = String(req.query.id ?? '');
  const order = await findFundingOrderById(id);
  if (!order?.fundingPledge) return res.status(404).json({ ok: false, message: '후원을 찾을 수 없습니다.' });
  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();
  const db = getDb();

  switch (b.action) {
    case 'confirm_deposit': {
      const r = await confirmBankDeposit({ orderId: order.id, now });
      return r.ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: r.message });
    }
    case 'refund': {
      const r = await cancelFundingPledge({
        orderNo: order.orderNo,
        requestedBy: 'admin',
        reason: typeof b.reason === 'string' && b.reason ? b.reason : '관리자 환불',
        now,
      });
      return r.ok ? res.status(200).json({ ok: true, mode: r.mode }) : res.status(CANCEL_STATUS[r.code] ?? 500).json({ ok: false, message: r.message });
    }
    case 'set_fulfillment': {
      const status = b.fulfillmentStatus;
      if (!(fulfillmentStatusEnum as readonly string[]).includes(status)) {
        return res.status(400).json({ ok: false, message: '발송 상태가 올바르지 않습니다.' });
      }
      if (order.status !== 'paid') return res.status(409).json({ ok: false, message: '확정된 후원만 발송 상태를 바꿀 수 있습니다.' });
      // 무통장 청약철회는 자동 환불 경로가 없어 refundRequestedAt만 찍히고 주문은 paid로
      // 남는다. 그 상태를 '발송 완료'로 바꿀 수 있게 두면, 청약철회한 사람에게 실물이
      // 나간 기록이 시스템 안에서 정상 발송으로 굳는다. 예외는 두지 않는다 — 되돌리려면
      // 환불을 처리하거나(주문이 refunded가 되어 이 분기 앞에서 걸린다) 아래
      // clear_refund_request로 요청을 취소하는 두 경로뿐이다. 후자는 사유를 필수로 받아
      // 관리자 메모에 날짜와 함께 덧붙이고 후원자에게 메일을 보낸다 — 즉 둘 다 흔적이 남고
      // 고객도 알게 된다.
      if (order.fundingPledge.refundRequestedAt) {
        return res.status(409).json({
          ok: false,
          message: '환불 요청된 후원입니다. 환불을 처리하거나 요청을 취소한 뒤에 발송 상태를 바꿔 주세요.',
        });
      }
      // 빈 문자열은 "지우기"다 — null로 저장해야 잘못 입력한 운송장을 비울 수 있다.
      const trackingCompany = typeof b.trackingCompany === 'string'
        ? (b.trackingCompany || null) : order.fundingPledge.trackingCompany;
      const trackingNumber = typeof b.trackingNumber === 'string'
        ? (b.trackingNumber || null) : order.fundingPledge.trackingNumber;

      /**
       * delivered_at은 약관 제13조가 약속한 '리워드 전달 완료 후 1년 파기'의 기산점이다.
       *
       * delivered로 갈 때: COALESCE로 **첫 전달 시각을 보존**한다. 운송장만 고쳐 다시 저장하는
       * 흔한 실무에서 기산점이 계속 밀리면 파기 시점도 함께 밀린다.
       * delivered에서 되돌릴 때(오조작 정정·반송): **NULL로 되돌린다.** 기산점은 '실제로
       * 전달이 끝난 시각'이어야 하는데, 잘못 눌러 찍힌 시각을 남겨 두면 아직 배송 중인 건의
       * 배송지가 1년 뒤 파기 대상이 된다. 기산점은 항상 현재 fulfillment_status와 일치시킨다.
       */
      const deliveredAt = status === 'delivered'
        ? sql`COALESCE(delivered_at, ${Math.floor(now.getTime() / 1000)})`
        : sql`NULL`;

      /**
       * 위 두 검사는 사람에게 이유를 알려 주기 위한 것이고, **경합을 막는 것은 이 WHERE다.**
       * 읽고-검사-쓰기 사이에 환불이 들어오면 두 요청이 모두 검사를 통과해 청약철회한 건이
       * '발송완료'로 굳는다. 조건을 UPDATE에 실으면 진 쪽이 rowsAffected 0을 받는다.
       * (lib/booking/cancel.ts의 선점 패턴과 같다.)
       */
      const claim = await db.run(sql`
        UPDATE funding_pledges
        SET fulfillment_status = ${status},
            tracking_company = ${trackingCompany},
            tracking_number = ${trackingNumber},
            delivered_at = ${deliveredAt},
            updated_at = unixepoch()
        WHERE id = ${order.fundingPledge.id}
          AND refund_requested_at IS NULL
          AND EXISTS (SELECT 1 FROM orders o WHERE o.id = funding_pledges.order_id AND o.status = 'paid')
      `);
      if (Number(claim.rowsAffected) === 0) {
        return res.status(409).json({
          ok: false,
          message: '그 사이 환불 요청이나 주문 상태 변경이 있었습니다. 새로고침 후 다시 확인해 주세요.',
        });
      }
      return res.status(200).json({ ok: true });
    }
    /**
     * 후원자가 취소 요청을 철회했거나 운영자가 잘못 접수한 경우의 유일한 되돌림 경로.
     * 이게 없으면 set_fulfillment 차단이 영구 잠금이 되고(refundRequestedAt을 지우는
     * 코드가 저장소에 하나도 없었다) 헬스체크가 매일 영구히 울려 경보 피로로 신호가 죽는다.
     *
     * 다만 이 액션은 **고객이 남긴 청약철회 의사를 지운다.** 조용히 지워지면 안 되므로
     * 세 가지를 강제한다: 사유 필수, 관리자 메모에 append(덮어쓰지 않는다 — 기존 메모가
     * 사라지면 그것도 기록 손실이다), 후원자에게 확인 메일. 상태 게이트는 화면·헬스체크와
     * 같은 집합이라 잔액이 남은 partially_refunded 건도 정리할 수 있다.
     */
    case 'clear_refund_request': {
      const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
      if (!reason) {
        return res.status(400).json({ ok: false, message: '환불 요청을 취소하려면 사유를 입력해야 합니다.' });
      }
      if (!order.fundingPledge.refundRequestedAt) {
        return res.status(409).json({ ok: false, message: '환불 요청이 없는 후원입니다.' });
      }
      if (!isRefundPendingStatus(order.status)) {
        return res.status(409).json({ ok: false, message: '확정 상태인 후원만 환불 요청을 취소할 수 있습니다.' });
      }
      const entry = `[${kstDateString(now)}] 환불 요청 취소 — ${reason}`;
      const memo = order.fundingPledge.adminMemo ? `${order.fundingPledge.adminMemo}\n${entry}` : entry;
      await db
        .update(fundingPledges)
        .set({ refundRequestedAt: null, adminMemo: memo, updatedAt: now })
        .where(eq(fundingPledges.id, order.fundingPledge.id));
      // 메일 실패가 기록을 되돌리지는 않는다(이 저장소의 원칙: 상태 변경은 끝났으므로
      // 후속 실패는 삼키되 기록한다). notificationError는 헬스체크가 매일 읽는다.
      const mailError = await sendFundingRefundRequestClearedEmails(order, getFundingProject(order.fundingPledge.projectSlug), reason);
      await db.update(orders).set({ notificationError: mailError, updatedAt: now }).where(eq(orders.id, order.id));
      return res.status(200).json({ ok: true, ...(mailError ? { message: `기록은 되었으나 메일 발송에 실패했습니다: ${mailError}` } : {}) });
    }
    /**
     * '재고 확인 완료' — needsReview 배지·배너·CSV 칸을 끄는 유일한 경로.
     *
     * clear_refund_request와 같은 모양을 쓴다(사유 필수, 관리자 메모에 append). 다른 점은
     * 후원자에게 메일을 보내지 않는다는 것뿐이다 — 이건 고객이 남긴 의사를 지우는 조작이
     * 아니라 운영 내부의 재고 확인 기록이라, 고객에게 알릴 내용이 없다.
     *
     * 덮어쓰지 않고 덧붙이는 이유도 같다: 웹훅이 남긴 경고 원문이 사라지면 "무엇을 확인한
     * 것인지"가 기록에서 없어진다. hasReviewMarker는 **마지막 경고 뒤에** 해제가 있는지를
     * 보므로, 같은 건이 다시 되살아나면 신호도 다시 켜진다.
     */
    case 'clear_stock_review': {
      const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
      if (!reason) {
        return res.status(400).json({ ok: false, message: '재고 확인을 닫으려면 확인 내용을 입력해야 합니다.' });
      }
      if (!hasReviewMarker(order.fundingPledge.adminMemo)) {
        return res.status(409).json({ ok: false, message: '재고 확인이 필요한 후원이 아닙니다.' });
      }
      // 해제 항목은 **반드시 한 줄**이어야 한다 — 판정이 줄 단위라, 사유에 개행이 들어가면
      // 둘째 줄부터는 해제 항목으로 분류되지 않는다. 운영자가 웹훅 원문을 그대로 붙여 넣어
      // 그 줄이 경고 형태(접두 + 마커)를 갖추면 해제 뒤에 새 경고가 선 꼴이 되어 다시 켜진다.
      // 개행을 공백으로 접어 그 경로를 없앤다(내용은 그대로 남는다).
      const entry = `[${kstDateString(now)}] ${REVIEW_CLEARED_MARKER} — ${reason.replace(/\s*\n\s*/g, ' ')}`;
      const memo = order.fundingPledge.adminMemo ? `${order.fundingPledge.adminMemo}\n${entry}` : entry;
      await db
        .update(fundingPledges)
        .set({ adminMemo: memo, updatedAt: now })
        .where(eq(fundingPledges.id, order.fundingPledge.id));
      return res.status(200).json({ ok: true });
    }
    case 'set_memo': {
      // 주의: 메모 전체를 덮어쓰는 액션이라 웹훅 표식도 함께 지워질 수 있다. 재고 확인을
      // '닫는' 의도라면 clear_stock_review를 쓸 것 — 그쪽은 원문을 남기고 사유를 강제한다.
      await db
        .update(fundingPledges)
        .set({ adminMemo: typeof b.adminMemo === 'string' ? b.adminMemo : null, updatedAt: now })
        .where(eq(fundingPledges.id, order.fundingPledge.id));
      return res.status(200).json({ ok: true });
    }
    case 'resend_email': {
      if (order.status !== 'paid' && !(order.status === 'pending' && order.fundingPledge.paymentMethod === 'bank_transfer')) {
        return res.status(409).json({ ok: false, message: '재발송할 메일이 없는 상태입니다.' });
      }
      // 수기 등록 건은 실제 고객 메일이 없다(플레이스홀더가 들어간다) — 재발송하면
      // 우리 도메인 주소로 되돌아오거나 반송된다.
      if (order.fundingPledge.entrySource === 'manual' && order.customerEmail === MANUAL_PLACEHOLDER_EMAIL) {
        return res.status(409).json({ ok: false, message: '수기 등록 건은 메일을 보내지 않습니다.' });
      }
      const project = getFundingProject(order.fundingPledge.projectSlug);
      const err = order.status === 'paid'
        ? await sendFundingConfirmedEmails(order, project)
        : await sendFundingBankDepositEmails(order, project);
      await db.update(orders).set({ notificationError: err, updatedAt: now }).where(eq(orders.id, order.id));
      return err ? res.status(502).json({ ok: false, message: err }) : res.status(200).json({ ok: true });
    }
    default:
      return res.status(400).json({ ok: false, message: 'action이 올바르지 않습니다.' });
  }
}
