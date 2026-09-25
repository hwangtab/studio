import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { fundingPledges, orders } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { REVIEW_CLEARED_MARKER, hasReviewMarker } from '../../../../../lib/funding/admin-serialize';
import { cancelFundingPledge } from '../../../../../lib/funding/cancel';
import { sendFundingCancelledEmails, sendFundingConfirmedEmails, sendFundingRefundRequestClearedEmails } from '../../../../../lib/funding/email';
import { setFulfillment } from '../../../../../lib/funding/fulfillment';
import { isRefundPendingStatus } from '../../../../../lib/funding/policy';
import { getFundingProjectAsync } from '../../../../../lib/funding/repository';
import { isRefundedFundingOrderStatus, remainingRefundable } from '../../../../../lib/funding/refundable';
import { findFundingOrderById, isManualPlaceholderRecipient } from '../../../../../lib/funding/service';
import { kstDateString } from '../../../../../lib/booking/kst';
import { SEND_INFLIGHT, SEND_PENDING } from '../../../../../lib/ops/notificationSentinel';

const CANCEL_STATUS: Record<string, number> = { not_found: 404, invalid_state: 409, toss_failed: 502, recording_failed: 500 };
// setFulfillment의 code → HTTP. forbidden(403)은 관리자 actor에서는 나오지 않지만
// 매핑은 함수 계약 전체를 다룬다(CANCEL_STATUS와 같은 관례).
const FULFILLMENT_STATUS: Record<string, number> = {
  not_found: 404, invalid_status: 400, not_live: 409, refund_requested: 409, conflict: 409, forbidden: 403,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });
  const id = String(req.query.id ?? '');
  const order = await findFundingOrderById(id);
  if (!order?.fundingPledge) return res.status(404).json({ ok: false, message: '펀딩 내역을 찾을 수 없습니다.' });
  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();
  const db = getDb();

  switch (b.action) {
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
      // 규칙 넷(살아 있는 주문 집합·환불 요청 차단·delivered_at의 COALESCE/NULL·경합을
      // 막는 UPDATE ... WHERE)은 lib/funding/fulfillment.ts로 옮겼다 — 개설자 경로가
      // 이 로직을 다시 구현하면 두 벌이 갈라져 한쪽만 고쳐지는 사고가 난다.
      const result = await setFulfillment({
        pledgeId: order.fundingPledge.id,
        status: b.fulfillmentStatus,
        trackingCompany: typeof b.trackingCompany === 'string' ? b.trackingCompany : undefined,
        trackingNumber: typeof b.trackingNumber === 'string' ? b.trackingNumber : undefined,
        actor: { kind: 'admin' },
        now,
      });
      if (!result.ok) {
        return res.status(FULFILLMENT_STATUS[result.code] ?? 500).json({ ok: false, message: result.message });
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
        return res.status(409).json({ ok: false, message: '환불 요청이 없는 펀딩입니다.' });
      }
      if (!isRefundPendingStatus(order.status)) {
        return res.status(409).json({ ok: false, message: '확정 상태인 펀딩만 환불 요청을 취소할 수 있습니다.' });
      }
      const entry = `[${kstDateString(now)}] 환불 요청 취소 — ${reason}`;
      const memo = order.fundingPledge.adminMemo ? `${order.fundingPledge.adminMemo}\n${entry}` : entry;
      await db
        .update(fundingPledges)
        .set({ refundRequestedAt: null, adminMemo: memo, updatedAt: now })
        .where(eq(fundingPledges.id, order.fundingPledge.id));
      // 메일 실패가 기록을 되돌리지는 않는다(이 저장소의 원칙: 상태 변경은 끝났으므로
      // 후속 실패는 삼키되 기록한다). notificationError는 헬스체크가 매일 읽는다.
      // 플레이스홀더 주소로는 보내지 않는다 — 반송이 발신 도메인 평판을 깎는다(cancel.ts와 같은 가드).
      const mailError = isManualPlaceholderRecipient(order)
        ? null
        : await sendFundingRefundRequestClearedEmails(order, await getFundingProjectAsync(order.fundingPledge.projectSlug), reason);
      /**
       * 성공(null)으로 덮을 때 **확정 메일 센티널은 지우지 않는다.** 이 주문은 여전히
       * paid라, `send_pending`을 지우면 웹훅의 확정 메일 복구 경로
       * (lib/funding/confirm.ts)가 그대로 닫힌다 — 후원자는 확정 메일도 관리 링크도
       * 못 받는다. 같은 가드가 lib/funding/cancel.ts에도 있다.
       */
      await db.run(
        mailError === null
          ? sql`UPDATE orders SET notification_error = NULL, updated_at = unixepoch() WHERE id = ${order.id}
                AND (notification_error IS NULL OR notification_error NOT IN (${SEND_PENDING}, ${SEND_INFLIGHT}))`
          : sql`UPDATE orders SET notification_error = ${mailError}, updated_at = unixepoch() WHERE id = ${order.id}`,
      );
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
        return res.status(409).json({ ok: false, message: '재고 확인이 필요한 펀딩이 아닙니다.' });
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
    /**
     * '내려받기 기록 초기화' — 셀프 취소를 되살리는 유일한 경로.
     *
     * `downloaded_at`은 약관 제8조 2항(전자상거래법 제17조 2항 5호)의 청약철회 제한 판정
     * 근거다. 그런데 **파일을 못 받았는데 기록만 남는** 상태가 실제로 생겼다 — CSP가
     * 내려받기 리디렉트를 막는 동안 서버는 그 전에 기록을 찍고 있었다(#153). 원인은
     * 고쳤지만, 되돌릴 수단이 없으면 같은 형태의 사고가 다시 났을 때 운영자가 DB를 직접
     * 만지는 수밖에 없다.
     *
     * clear_refund_request·clear_stock_review와 같은 모양을 쓴다(사유 필수, 관리자 메모에
     * 날짜와 함께 덧붙임). 후원자에게 메일은 보내지 않는다 — 이건 고객이 남긴 의사를
     * 지우는 조작이 아니라 **잘못 남은 기록을 바로잡아 권리를 되돌려 주는** 일이고,
     * 대개 고객 문의에 대한 답으로 이뤄지므로 그 답신이 안내를 대신한다.
     */
    case 'clear_download_record': {
      const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
      if (!reason) {
        return res.status(400).json({ ok: false, message: '내려받기 기록을 지우려면 사유를 입력해야 합니다.' });
      }
      if (!order.fundingPledge.downloadedAt) {
        return res.status(409).json({ ok: false, message: '내려받기 기록이 없는 펀딩입니다.' });
      }
      const entry = `[${kstDateString(now)}] 내려받기 기록 초기화 — ${reason.replace(/\s*\n\s*/g, ' ')}`;
      const memo = order.fundingPledge.adminMemo ? `${order.fundingPledge.adminMemo}\n${entry}` : entry;
      await db
        .update(fundingPledges)
        .set({ downloadedAt: null, adminMemo: memo, updatedAt: now })
        .where(eq(fundingPledges.id, order.fundingPledge.id));
      return res.status(200).json({ ok: true });
    }
    case 'unpublish': {
      /**
       * 공개 명단에서 내린다 — 이름과 응원 메시지가 함께 빠진다(공개 동의가 그 둘을 한
       * 단위로 받는다). 타인의 권리를 침해하거나 프로젝트와 무관한 메시지를 내리기 위한
       * 수단이고, 약관 제13조가 그럴 수 있다고 고지한다.
       *
       * 메시지 본문은 지우지 않는다. 표시만 내리고 기록은 남겨 둔다 — 왜 내렸는지 나중에
       * 확인할 수 있어야 하고, 후원자가 이의를 제기할 수도 있다.
       */
      await db
        .update(fundingPledges)
        .set({ displayNamePublic: false, updatedAt: now })
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
      // 이메일 칸을 비운 수기 등록 건은 customer_email이 플레이스홀더다 — 보내면 우리
      // 도메인 주소로 되돌아오거나 반송된다. 실제 주소를 넣은 수기 등록은 이 분기를 타지
      // 않고, 등록 시점에 이미 확정 메일이 한 번 나간다(pledges/index.ts).
      if (isManualPlaceholderRecipient(order)) {
        return res.status(409).json({ ok: false, message: '받는 사람 주소가 없는 수기 등록 건입니다. 메일을 보내지 않습니다.' });
      }
      /**
       * 무엇을 다시 보낼지는 **주문 상태**가 정한다 — 예약 쪽(pages/api/admin/bookings/[id].ts)의
       * cancelled 분기와 같은 모양이다.
       *
       * 예전엔 `order.status !== 'paid'`면 통째로 409였다. 그런데 취소 메일 발송이 실패하면
       * (Resend non-2xx·네트워크 오류) cancelFundingPledge가 이미 주문을 refunded로 옮긴 뒤라,
       * 그 실패 문자열이 orders.notificationError에 **영구히** 박혔다: 화면은 "아래 메일
       * 재발송을 눌러 주세요" 배너를 띄우는데 그 버튼이 409를 돌려주고, 컬럼을 비우는 다른
       * 경로도 없어 헬스체크의 '확인 메일이 나가지 않은 주문 N건' 알람이 매일 영원히 울렸다.
       * 경보 피로로 신호가 죽는 것이 이 저장소가 반복해서 막아 온 실패 모드다.
       */
      const project = await getFundingProjectAsync(order.fundingPledge.projectSlug);
      let err: string | null;
      if (order.status === 'paid') {
        err = await sendFundingConfirmedEmails(order, project);
      } else if (isRefundedFundingOrderStatus(order.status)) {
        /**
         * 금액은 **원래 취소 메일이 말한 것과 같아야 한다** — totalAmount를 그대로 적으면 이미
         * 돌려준 몫까지 다시 돌려주는 것처럼 읽힌다(email.ts CANCEL_BODY 주석).
         *
         * 토스 건은 refunds에 done 행이 남으므로 `총액 − 잔액`이 실제로 나간 금액이다.
         * 토스 결제가 없는 옛 무통장·수기 건은 cancel.ts가 refunds 행을 만들지 않고
         * 'recorded'(계좌 송금 완료 안내) 모드로 **잔액 전부**를 보냈으므로 그 값을 쓴다.
         */
        const remaining = remainingRefundable(order);
        const isTossRefund = order.payments.length > 0;
        const refundedAmount = isTossRefund ? order.totalAmount - remaining : remaining;
        /**
         * 0원이면 보낼 것이 없다 — 보내면 고객에게 "0원이 환불됩니다"가 나간다.
         *
         * 실제로 생기는 상태다: 웹훅이 orders.status만 refunded로 옮기고 refunds 기록이
         * 아직 붙지 않은 창(대사 보정 전), 또는 기록이 실패한 건. 그 창에서 재발송을 누르면
         * 계산값이 0이 된다. 금액을 지어내느니 거절하고, 대사가 끝난 뒤 다시 누르게 한다.
         */
        if (refundedAmount <= 0) {
          return res.status(409).json({
            ok: false,
            message: '환불 기록이 아직 없어 안내할 금액을 계산할 수 없습니다. 결제사 대사가 끝난 뒤 다시 시도해 주세요.',
          });
        }
        err = await sendFundingCancelledEmails(order, project, isTossRefund ? 'refunded' : 'recorded', refundedAmount);
      } else {
        return res.status(409).json({ ok: false, message: '결제가 완료되었거나 환불된 펀딩만 메일을 재발송할 수 있습니다.' });
      }
      /**
       * 여기서는 센티널을 **지운다** — 위 두 곳과 반대다. 이 버튼은 운영자가 실제로 메일을
       * 다시 보낸 경로이고, 센티널을 지울 수 있는 유일한 경로다. 여기까지 가드를 걸면
       * 발송 도중 중단된 주문의 경보를 끌 방법이 없어져 매일 영원히 울린다(위 주석의
       * 경보 피로가 정확히 그 사고였다).
       */
      await db.update(orders).set({ notificationError: err, updatedAt: now }).where(eq(orders.id, order.id));
      return err ? res.status(502).json({ ok: false, message: err }) : res.status(200).json({ ok: true });
    }
    default:
      return res.status(400).json({ ok: false, message: 'action이 올바르지 않습니다.' });
  }
}
