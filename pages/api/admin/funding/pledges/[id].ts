import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { fulfillmentStatusEnum, fundingPledges, orders } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { confirmBankDeposit } from '../../../../../lib/funding/bank-transfer';
import { cancelFundingPledge } from '../../../../../lib/funding/cancel';
import { sendFundingBankDepositEmails, sendFundingConfirmedEmails } from '../../../../../lib/funding/email';
import { getFundingProject } from '../../../../../lib/funding/projects';
import { findFundingOrderById } from '../../../../../lib/funding/service';

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
      await db
        .update(fundingPledges)
        .set({
          fulfillmentStatus: status,
          trackingCompany: typeof b.trackingCompany === 'string' ? b.trackingCompany : order.fundingPledge.trackingCompany,
          trackingNumber: typeof b.trackingNumber === 'string' ? b.trackingNumber : order.fundingPledge.trackingNumber,
          updatedAt: now,
        })
        .where(eq(fundingPledges.id, order.fundingPledge.id));
      return res.status(200).json({ ok: true });
    }
    case 'set_memo': {
      await db
        .update(fundingPledges)
        .set({ adminMemo: typeof b.adminMemo === 'string' ? b.adminMemo : null, updatedAt: now })
        .where(eq(fundingPledges.id, order.fundingPledge.id));
      return res.status(200).json({ ok: true });
    }
    case 'resend_email': {
      const project = getFundingProject(order.fundingPledge.projectSlug);
      const err =
        order.status === 'paid'
          ? await sendFundingConfirmedEmails(order, project)
          : order.fundingPledge.paymentMethod === 'bank_transfer'
            ? await sendFundingBankDepositEmails(order, project)
            : '재발송할 메일이 없는 상태';
      await db.update(orders).set({ notificationError: err, updatedAt: now }).where(eq(orders.id, order.id));
      return err ? res.status(502).json({ ok: false, message: err }) : res.status(200).json({ ok: true });
    }
    default:
      return res.status(400).json({ ok: false, message: 'action이 올바르지 않습니다.' });
  }
}
