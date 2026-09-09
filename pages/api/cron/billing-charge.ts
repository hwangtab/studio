/**
 * 정기결제(구독) 일일 청구. 스펙 §6·§9.
 *
 * 순서: 해지 예정일이 지난 구독을 먼저 닫고(endExpiredSubscriptions) → 이번 회차에 청구할
 * 구독 목록(listDueSubscriptions)을 순회한다. 각 건은 독립적으로 try/catch한다 — 한 구독의
 * 실패가 나머지 구독의 청구를 막으면 안 된다(스펙 §9, cron의 존재 이유).
 *
 * **NETWORK_ERROR 대사는 chargeCycle이 한다.** cron 전용으로 두면 관리자 수동 결제·카드
 * 재등록 첫 결제 등 chargeCycle을 부르는 다른 경로가 같은 이중 청구 위험을 그대로 안기
 * 때문에, "지난 pending 회차를 fetchPaymentByOrderId로 재조회해 반영"하는 로직은
 * lib/billing/service.ts의 chargeCycle 본문(unresolved 블록)으로 옮겨졌다 — 모든 호출부가
 * 공통으로 그 혜택을 받는다. cron은 그 결과(ok/status)만 보고 메일을 고르면 된다.
 *
 * **동시 실행 방어.** chargeCycle 자체가 이미 subscriptionPayments의
 * (subscriptionId, cycleYm, attempt) 유니크 인덱스 + "INSERT가 토스 호출보다 먼저"라는
 * 순서로 이중 청구를 막는다(claimDueSubscription 주석 참조) — 두 프로세스가 동시에 같은
 * 회차를 청구해도 토스에 결제 요청이 두 번 나가지는 않는다. claimDueSubscription은 그
 * 방어가 못 막는 좁은 구멍(주인 없는 pending orders 행 중복 생성)만 추가로 막는다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { subscriptions, type Subscription } from '../../../db/schema';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { chargeCycle, claimDueSubscription, endExpiredSubscriptions, listDueSubscriptions } from '../../../lib/billing/service';
import {
  sendSubscriptionChargedEmail,
  sendSubscriptionChargeFailedEmail,
  sendSubscriptionOperatorAlert,
  subscriptionManageUrl,
} from '../../../lib/billing/email';
import { cycleYmOf } from '../../../lib/billing/schedule';

export const config = { maxDuration: 60 };

/** 재등록 안내 힌트 — pages/api/admin/subscriptions/[id].ts의 같은 이름 함수와 동일 문구(카피 정본은 그쪽). */
const cardChangeHint = (paused: boolean): string =>
  paused
    ? '정기결제가 정지되었습니다. 위 링크에서 카드를 다시 등록해야 이용이 계속됩니다.'
    : '카드 정보가 오래되었거나 한도 초과일 수 있습니다. 위 링크에서 카드를 다시 등록해 주세요.';

type ChargeSummary = {
  due: number;
  charged: number;
  failed: number;
  paused: number;
  ended: number;
  skipped: number;
  errors: Array<{ subscriptionId: string; message: string }>;
};

const processOne = async (sub: Subscription, now: Date, summary: ChargeSummary): Promise<void> => {
  const cycleYm = cycleYmOf(now);

  // 동시 실행 방어 — 다른 cron 실행이나 관리자 수동 결제가 먼저 가져갔으면 조용히 넘어간다.
  // NETWORK_ERROR로 pending에 남은 지난 회차의 재조회 대사는 이제 chargeCycle 본문이
  // 스스로 한다(unresolved 블록) — cron만이 아니라 관리자 수동 결제·카드 재등록 첫 결제도
  // 같은 위험을 안기 때문에 호출부가 아니라 chargeCycle 쪽으로 옮겨졌다. cron은 그 결과만
  // 보고 메일을 고르면 된다.
  const claimed = await claimDueSubscription(sub.id, sub.nextBillingAt ?? now);
  if (!claimed) {
    summary.skipped += 1;
    return;
  }

  const result = await chargeCycle(sub.id, now, { reason: sub.status === 'past_due' ? 'retry' : 'scheduled' });
  const manageUrl = subscriptionManageUrl(sub);

  if (result.ok) {
    summary.charged += 1;
    const notificationError = await sendSubscriptionChargedEmail(sub, {
      amount: sub.totalAmount,
      cycleYm: result.cycleYm ?? cycleYm,
      paymentKey: result.paymentKey,
      manageUrl,
    });
    if (notificationError) {
      await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, sub.id));
    }
    return;
  }

  summary.failed += 1;
  const paused = result.status === 'paused';
  if (paused) summary.paused += 1;

  const refreshed = await getDb().query.subscriptions.findFirst({ where: (t, { eq: eq_ }) => eq_(t.id, sub.id) });
  const notificationError = await sendSubscriptionChargeFailedEmail(sub, {
    amount: sub.totalAmount,
    cycleYm: result.cycleYm ?? cycleYm,
    nextRetryAt: paused ? null : (refreshed?.nextBillingAt ?? null),
    manageUrl,
    cardChangeHint: cardChangeHint(paused),
  });
  if (paused) {
    await sendSubscriptionOperatorAlert(sub, 'paused', `자동 재시도 한도 소진 — ${result.message ?? ''}`);
  }
  if (notificationError) {
    await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, sub.id));
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  if (!isCronAuthorized(req, 'cron/billing-charge')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const now = new Date();
  const summary: ChargeSummary = { due: 0, charged: 0, failed: 0, paused: 0, ended: 0, skipped: 0, errors: [] };

  try {
    summary.ended = await endExpiredSubscriptions(now);
    const due = await listDueSubscriptions(now);
    summary.due = due.length;

    for (const sub of due) {
      try {
        await processOne(sub, now, summary);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[cron/billing-charge] 회차 처리 실패', { subscriptionId: sub.id, error });
        summary.errors.push({ subscriptionId: sub.id, message });
      }
    }

    if (summary.errors.length > 0) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: `[Studio NOL] 정기결제 cron 일부 실패 — ${summary.errors.length}건`,
        text:
          `정기결제 청구 중 일부 구독에서 예외가 발생했습니다.\n\n` +
          `대상 ${summary.due}건 / 성공 ${summary.charged}건 / 실패 ${summary.failed}건 / 예외 ${summary.errors.length}건\n\n` +
          summary.errors.map((e) => `- ${e.subscriptionId}: ${e.message}`).join('\n') +
          '\n\n예외가 난 구독은 다음 cron 실행에서 다시 시도됩니다(멱등) — 반복되면 확인이 필요합니다.',
      }).catch((mailError: unknown) => console.error('[cron/billing-charge] 알림 메일 실패', mailError));
    }

    // 예외가 있어도 200을 준다 — 재시도는 다음 cron이 자연히 한다(각 회차가 멱등이라 안전).
    // 여기서 500을 주면 Vercel Cron이 곧바로 재시도하는데, 이 라우트는 매번 listDueSubscriptions
    // **전체**를 다시 순회하므로 이미 성공한 구독까지 다시 훑게 된다(성공 건은 chargeCycle의
    // "이미 paid" 멱등 체크로 안전하게 no-op되지만, 실패가 반복될 구독의 재시도 리듬만
    // 예상보다 촘촘해질 뿐 새로운 위험은 없다) — 다만 즉시 재시도가 유익하지 않은 실패
    // (DB·네트워크 일시 장애로 이미 알림 메일도 나갔다)이므로 200으로 마무리한다.
    return res.status(200).json({ ok: summary.errors.length === 0, ...summary });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/billing-charge] Failed:', error);
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 정기결제 cron 전체 실패',
      text: `정기결제 청구 작업 자체가 실행되지 못했습니다.\n\n사유: ${detail}`,
    }).catch(() => {});
    return res.status(500).json({ ok: false, message: '정기결제 청구에 실패했습니다.' });
  }
}
