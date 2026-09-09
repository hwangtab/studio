import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { subscriptionPayments, subscriptions } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { createSubscription, endExpiredSubscriptions } from '../../../../lib/billing/service';
import { sendSubscriptionSetupEmail, subscriptionSetupUrl } from '../../../../lib/billing/email';

const LIST_LIMIT = 200;

const isBillingDay = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 31;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const CREATE_ERROR_STATUS: Record<string, number> = {
  already_exists: 409,
  contract_required: 400,
  invalid_billing_day: 400,
};

const CREATE_ERROR_MESSAGE: Record<string, string> = {
  already_exists: '이미 진행 중인 구독이 있습니다.',
  contract_required: '연습실 구독은 계약이 필요합니다.',
  invalid_billing_day: '결제일은 1~31 사이여야 합니다.',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // 목록을 여는 시점이 곧 만료를 판정할 시점이다(bookings·contracts와 같은 lazy 처리).
      await endExpiredSubscriptions(new Date());

      const { contractId } = req.query;

      const rows = await getDb().query.subscriptions.findMany({
        where: typeof contractId === 'string' ? (t, { eq }) => eq(t.contractId, contractId) : undefined,
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: LIST_LIMIT,
      });

      // 미납 회차 수 — 회차별 실패 시도(재시도 소진 여부와 무관, 근사치). 목록 배지용이라
      // 정확한 "해결 안 된 실패"까지는 계산하지 않는다(상세 화면의 회차 이력이 정본).
      const failedCounts = await getDb()
        .select({ subscriptionId: subscriptionPayments.subscriptionId, count: sql<number>`count(*)` })
        .from(subscriptionPayments)
        .where(eq(subscriptionPayments.status, 'failed'))
        .groupBy(subscriptionPayments.subscriptionId);
      const failedCountBySubscription = new Map(failedCounts.map((row) => [row.subscriptionId, row.count]));

      return res.status(200).json({
        ok: true,
        subscriptions: rows.map((row) => ({ ...row, failedCount: failedCountBySubscription.get(row.id) ?? 0 })),
      });
    } catch (error: unknown) {
      console.error('[API/admin/subscriptions] Failed to list subscriptions:', error);
      return res.status(500).json({ ok: false, message: '구독 목록을 불러오지 못했습니다.' });
    }
  }

  if (req.method === 'POST') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }
    const body = req.body as Record<string, unknown>;

    const { kind, contractId, customerName, customerPhone, customerEmail, billingDay } = body;

    if (kind !== 'practice-room' && kind !== 'lesson') {
      return res.status(400).json({ ok: false, message: 'kind는 practice-room 또는 lesson이어야 합니다.' });
    }
    if (!isNonEmptyString(customerName) || !isNonEmptyString(customerPhone) || !isNonEmptyString(customerEmail)) {
      return res.status(400).json({ ok: false, message: '고객 정보를 입력해 주세요.' });
    }
    if (!isBillingDay(billingDay)) {
      return res.status(400).json({ ok: false, message: '결제일은 1~31 사이의 정수여야 합니다.' });
    }
    if (contractId !== undefined && !isNonEmptyString(contractId)) {
      return res.status(400).json({ ok: false, message: 'contractId가 올바르지 않습니다.' });
    }

    try {
      const now = new Date();
      const result = await createSubscription(
        {
          kind,
          contractId: typeof contractId === 'string' ? contractId : undefined,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          billingDay,
        },
        now,
      );

      if (!result.ok) {
        return res
          .status(CREATE_ERROR_STATUS[result.code] ?? 400)
          .json({ ok: false, code: result.code, message: CREATE_ERROR_MESSAGE[result.code] ?? '구독 생성에 실패했습니다.' });
      }

      const setupUrl = subscriptionSetupUrl({ id: result.id }, result.setupToken);

      const subscription = await getDb().query.subscriptions.findFirst({
        where: (t, { eq }) => eq(t.id, result.id),
      });
      const notificationError = subscription ? await sendSubscriptionSetupEmail(subscription, setupUrl) : null;
      if (notificationError) {
        await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, result.id));
      }

      return res.status(201).json({ ok: true, id: result.id, setupUrl });
    } catch (error: unknown) {
      console.error('[API/admin/subscriptions] Failed to create subscription:', error);
      return res.status(500).json({ ok: false, message: '구독 생성에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
