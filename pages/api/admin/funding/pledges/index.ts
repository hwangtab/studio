import { randomUUID } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { fundingPledges, orders } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { generateManageToken } from '../../../../../lib/booking/token';
import { listFundingOrders } from '../../../../../lib/funding/admin-list';
import { duplicateKey, serializePledgeForAdmin } from '../../../../../lib/funding/admin-serialize';
import { computeFundingAmounts } from '../../../../../lib/funding/amounts';
import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from '../../../../../lib/funding/policy';
import { findReward, getFundingProject } from '../../../../../lib/funding/projects';
import { aggregateProjectStatus, expireStalePledges, generateFundingOrderNo } from '../../../../../lib/funding/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method === 'GET') {
    await expireStalePledges(new Date());
    const slug = typeof req.query.slug === 'string' ? req.query.slug : null;
    const items = await listFundingOrders(slug);
    const counts = new Map<string, number>();
    for (const o of items) {
      if (o.status === 'pending' && o.fundingPledge?.paymentMethod === 'bank_transfer') {
        counts.set(duplicateKey(o), (counts.get(duplicateKey(o)) ?? 0) + 1);
      }
    }
    const dups = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
    return res.status(200).json({
      ok: true,
      items: items.slice(0, 200).map((o) => serializePledgeForAdmin(o, dups)),
      truncated: items.length > 200,
    });
  }

  if (req.method === 'POST') {
    const b = (typeof req.body === 'object' && req.body) || {};
    const project = getFundingProject(String(b.projectSlug ?? ''));
    const reward = project && typeof b.rewardId === 'string' ? findReward(project, b.rewardId) : undefined;
    const quantity = Number(b.quantity ?? 1);
    const additionalAmount = Number(b.additionalAmount ?? 0);
    if (
      !project ||
      !reward ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY ||
      !Number.isInteger(additionalAmount) ||
      additionalAmount < 0 ||
      additionalAmount > MAX_ADDITIONAL_AMOUNT ||
      additionalAmount % ADDITIONAL_AMOUNT_STEP !== 0 ||
      typeof b.customerName !== 'string' ||
      !b.customerName
    ) {
      return res.status(400).json({ ok: false, message: '프로젝트·리워드·수량·이름을 확인해 주세요.' });
    }
    const now = new Date();
    await expireStalePledges(now);
    if (reward.totalQuantity !== null) {
      const status = await aggregateProjectStatus(project, now);
      const remaining = status.remaining[reward.id];
      if (remaining !== null && remaining !== undefined && quantity > remaining) {
        return res.status(409).json({ ok: false, message: `남은 수량(${remaining})을 초과합니다.` });
      }
    }
    const amounts = computeFundingAmounts(reward.amount, quantity, additionalAmount);
    const orderNo = generateFundingOrderNo(now, true);
    const db = getDb();
    const s = (typeof b.shipping === 'object' && b.shipping) || {};
    const orderId = randomUUID().replace(/-/g, '');
    const pledgeId = randomUUID().replace(/-/g, '');
    // orders·funding_pledges INSERT를 하나의 배치로 묶는다 — 둘 중 하나만 성공하면
    // payments 없이 paid로 남는 고아 주문이 생긴다(예약 confirm.ts의 batch 패턴).
    await db.batch([
      db.insert(orders).values({
        id: orderId,
        orderNo,
        type: 'funding',
        status: 'paid',
        customerName: b.customerName,
        customerPhone: String(b.customerPhone ?? '-'),
        // ?? 는 빈 문자열을 통과시킨다 — 관리자 폼이 비운 이메일 칸을 그대로 보내면
        // customer_email=''인 주문이 생겨 확정 메일이 빈 주소로 나가고 실패한다. 공백만 있는
        // 입력도 같다. 실제로 값이 있을 때만 쓰고, 아니면 플레이스홀더로 떨어뜨린다.
        customerEmail: String(b.customerEmail || '').trim() || 'manual@studionol.co.kr',
        ...amounts,
        manageToken: generateManageToken(),
      }),
      db.insert(fundingPledges).values({
        id: pledgeId,
        orderId,
        projectSlug: project.slug,
        rewardId: reward.id,
        rewardTitle: reward.title,
        unitAmount: reward.amount,
        quantity,
        additionalAmount,
        paymentMethod: 'bank_transfer',
        holdExpiresAt: now,
        paidAt: now,
        displayNamePublic: b.displayNamePublic === true,
        entrySource: 'manual',
        shippingName: s.name ?? null,
        shippingPhone: s.phone ?? null,
        shippingPostcode: s.postcode ?? null,
        shippingAddress1: s.address1 ?? null,
        shippingAddress2: s.address2 ?? null,
        shippingMemo: s.memo ?? null,
        adminMemo: typeof b.adminMemo === 'string' ? b.adminMemo : null,
      }),
    ]);
    return res.status(201).json({ ok: true, orderNo });
  }
  return res.status(405).json({ ok: false });
}
