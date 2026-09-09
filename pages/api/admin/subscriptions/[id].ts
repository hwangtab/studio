import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { subscriptions } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import {
  cancelSubscription,
  chargeCycle,
  findSubscriptionById,
  getSubscriptionWithDetails,
  issueCardChangeToken,
  pauseSubscription,
  resumeSubscription,
} from '../../../../lib/billing/service';
import {
  sendSubscriptionCancelledEmail,
  sendSubscriptionChargedEmail,
  sendSubscriptionChargeFailedEmail,
  sendSubscriptionOperatorAlert,
  sendSubscriptionSetupEmail,
  subscriptionManageUrl,
  subscriptionSetupUrl,
} from '../../../../lib/billing/email';
import { generateSetupToken, SETUP_TOKEN_TTL_SECONDS } from '../../../../lib/billing/token';

const ACTIONS = ['charge', 'cancel', 'pause', 'resume', 'card_change_link', 'resend_setup'] as const;
type Action = (typeof ACTIONS)[number];

const isAction = (value: unknown): value is Action =>
  typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);

/** 재등록 안내에 붙이는 힌트 — 정지 여부에 따라 문구가 다르다. */
const cardChangeHint = (paused: boolean): string =>
  paused
    ? '정기결제가 정지되었습니다. 위 링크에서 카드를 다시 등록해야 이용이 계속됩니다.'
    : '카드 정보가 오래되었거나 한도 초과일 수 있습니다. 위 링크에서 카드를 다시 등록해 주세요.';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string' || id.trim() === '') {
    return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  }

  if (req.method === 'GET') {
    try {
      const details = await getSubscriptionWithDetails(id);
      if (!details) {
        return res.status(404).json({ ok: false, message: '구독을 찾을 수 없습니다.' });
      }
      return res.status(200).json({ ok: true, ...details });
    } catch (error: unknown) {
      console.error('[API/admin/subscriptions/[id]] Failed to load subscription:', error);
      return res.status(500).json({ ok: false, message: '구독을 불러오지 못했습니다.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }
  const body = req.body as Record<string, unknown>;
  const { action } = body;
  if (!isAction(action)) {
    return res.status(400).json({ ok: false, message: `action은 ${ACTIONS.join(', ')} 중 하나여야 합니다.` });
  }

  const now = new Date();

  try {
    if (action === 'charge') {
      const subscription = await findSubscriptionById(id);
      if (!subscription) return res.status(404).json({ ok: false, message: '구독을 찾을 수 없습니다.' });

      const result = await chargeCycle(id, now, { reason: 'manual' });
      const manageUrl = subscriptionManageUrl(subscription);

      if (result.ok) {
        const notificationError = await sendSubscriptionChargedEmail(subscription, {
          amount: subscription.totalAmount,
          cycleYm: result.cycleYm ?? '',
          paymentKey: result.paymentKey,
          manageUrl,
        });
        if (notificationError) {
          await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, id));
        }
        return res.status(200).json({ ok: true, status: result.status, paymentKey: result.paymentKey });
      }

      // 첫 결제 실패(pending_card 유지)와 정기 재시도 실패(past_due/paused)를 구분해 메일을 고른다.
      if (result.status === 'pending_card') {
        return res.status(409).json({ ok: false, code: 'charge_failed', message: result.message ?? '결제에 실패했습니다.' });
      }

      const refreshed = await findSubscriptionById(id);
      const paused = result.status === 'paused';
      const notificationError = await sendSubscriptionChargeFailedEmail(subscription, {
        amount: subscription.totalAmount,
        cycleYm: result.cycleYm ?? '',
        nextRetryAt: refreshed?.nextBillingAt ?? null,
        manageUrl,
        cardChangeHint: cardChangeHint(paused),
      });
      if (paused) {
        await sendSubscriptionOperatorAlert(subscription, 'paused', `수동 결제 재시도 한도 소진 — ${result.message ?? ''}`);
      }
      if (notificationError) {
        await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, id));
      }
      return res.status(409).json({ ok: false, code: 'charge_failed', status: result.status, message: result.message ?? '결제에 실패했습니다.' });
    }

    if (action === 'cancel') {
      const { reason } = body;
      const reasonText = typeof reason === 'string' ? reason.trim() : '';
      if (reasonText === '') {
        return res.status(400).json({ ok: false, message: '해지 사유를 입력해 주세요.' });
      }

      const result = await cancelSubscription(id, { requestedBy: 'admin', reason: reasonText }, now);
      if (!result.ok) {
        return res
          .status(result.code === 'not_found' ? 404 : 409)
          .json({ ok: false, message: result.code === 'not_found' ? '구독을 찾을 수 없습니다.' : '이미 해지되었거나 종료된 구독입니다.' });
      }

      const endsAt = result.subscription.endsAt ?? now;
      const notificationError = await sendSubscriptionCancelledEmail(result.subscription, { endsAt });
      await sendSubscriptionOperatorAlert(result.subscription, 'cancelled', `사유: ${reasonText}`);
      if (notificationError) {
        await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, id));
      }
      return res.status(200).json({ ok: true, endsAt: endsAt.toISOString() });
    }

    if (action === 'pause') {
      const result = await pauseSubscription(id, now);
      if (!result.ok) {
        return res
          .status(result.code === 'not_found' ? 404 : 409)
          .json({ ok: false, message: result.code === 'not_found' ? '구독을 찾을 수 없습니다.' : '지금 상태에서는 일시정지할 수 없습니다.' });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'resume') {
      const result = await resumeSubscription(id, now);
      if (!result.ok) {
        return res
          .status(result.code === 'not_found' ? 404 : 409)
          .json({ ok: false, message: result.code === 'not_found' ? '구독을 찾을 수 없습니다.' : '정지 상태가 아니면 재개할 수 없습니다.' });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'card_change_link') {
      const subscription = await findSubscriptionById(id);
      if (!subscription) return res.status(404).json({ ok: false, message: '구독을 찾을 수 없습니다.' });

      const result = await issueCardChangeToken(id, now);
      if (!result.ok) {
        return res.status(409).json({ ok: false, message: '지금 상태에서는 카드 변경 링크를 발급할 수 없습니다.' });
      }
      const setupUrl = subscriptionSetupUrl(subscription, result.setupToken);
      const notificationError = await sendSubscriptionSetupEmail(subscription, setupUrl);
      if (notificationError) {
        await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, id));
      }
      return res.status(200).json({ ok: true, url: setupUrl });
    }

    if (action === 'resend_setup') {
      const subscription = await findSubscriptionById(id);
      if (!subscription) return res.status(404).json({ ok: false, message: '구독을 찾을 수 없습니다.' });
      if (subscription.status !== 'pending_card') {
        return res.status(409).json({ ok: false, message: '카드 등록 대기 중인 구독만 재발송할 수 있습니다.' });
      }

      // 토큰이 아직 유효하면(1회성 미소진 + 만료 전) 그대로 재발송, 아니면 새로 발급한다.
      let setupToken = subscription.setupToken;
      const stillValid =
        !!setupToken && !!subscription.setupTokenExpiresAt && subscription.setupTokenExpiresAt.getTime() > now.getTime();

      if (!stillValid) {
        setupToken = generateSetupToken();
        await getDb()
          .update(subscriptions)
          .set({
            setupToken,
            setupTokenExpiresAt: new Date(now.getTime() + SETUP_TOKEN_TTL_SECONDS * 1000),
            updatedAt: now,
          })
          .where(eq(subscriptions.id, id));
      }

      const setupUrl = subscriptionSetupUrl(subscription, setupToken!);
      const notificationError = await sendSubscriptionSetupEmail(subscription, setupUrl);
      if (notificationError) {
        await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, id));
      }
      return res.status(200).json({ ok: true, url: setupUrl });
    }

    return res.status(400).json({ ok: false, message: '알 수 없는 작업입니다.' });
  } catch (error: unknown) {
    console.error('[API/admin/subscriptions/[id]] Action failed:', { id, action, error });
    return res.status(500).json({ ok: false, message: '요청을 처리하지 못했습니다.' });
  }
}
