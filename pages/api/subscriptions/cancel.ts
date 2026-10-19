import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { sendSubscriptionCancelledEmail, sendSubscriptionOperatorAlert } from '../../../lib/billing/email';
import { cancelSubscription, findSubscriptionForManage, firstPaidAtOf, paidCycleCountOf } from '../../../lib/billing/service';

/** 청약철회 기간 — 첫 결제 후 7일(lib/booking/refund-policy.ts ARTIST_SUPPORT_REFUND_POLICY_LINES). KST 달력 날짜로 센다. */
const WITHDRAWAL_WINDOW_DAYS = 7;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstDayNumber = (d: Date): number => Math.floor((d.getTime() + KST_OFFSET_MS) / (24 * 60 * 60 * 1000));
const kstDateLabel = (d: Date): string => new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * 해지 시점의 환불 판정 힌트 — 환불은 자동 실행이 아니라 관리자 화면의 회차 환불이므로(refund-policy.ts),
 * 운영자가 약속을 이행할 트리거는 이 알림뿐이다. 고객 메일에도 같은 사실을 한 줄 적는다(정책 문구 밖의 기한은 약속하지 않는다).
 * "7일 이내"는 첫날을 세지 않는 보통의 날짜 계산 — 결제일 + 7일의 KST 24:00까지다(168시간으로 자르면 하루 가까이 먼저 끊긴다).
 */
const refundHint = (kind: string, firstPaidAt: Date | null, paidCycles: number, now: Date): { operator: string; customer?: string } => {
  if (kind === 'artist-support') {
    if (firstPaidAt && kstDayNumber(now) - kstDayNumber(firstPaidAt) <= WITHDRAWAL_WINDOW_DAYS)
      return {
        operator: `첫 결제(${kstDateLabel(firstPaidAt)}) 후 7일 이내 해지 — 전액 환불 대상. 관리자 > 구독 상세에서 회차를 환불해 주세요.`,
        customer: '첫 결제 후 7일 이내 해지라 결제하신 금액은 전액 환불해 드려요.',
      };
    return { operator: '첫 결제 후 7일이 지난 해지 — 남은 기간 일할 환급은 고객 요청 시 처리.' };
  }
  if (kind === 'lesson') {
    return paidCycles <= 1
      ? { operator: '첫 수업 전 해지면 전액 환불 대상 — 수업 시작 여부를 확인해 주세요.' }
      : { operator: `결제 ${paidCycles}회차 뒤 해지 — 잔여 회차 환불은 상담으로 안내.` };
  }
  return { operator: '연습실은 임대차 계약서(제2조·제4조·제9조)에 따릅니다.' };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`subscription_manage:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });

  const { id, token } = req.body as Record<string, unknown>;
  if (typeof id !== 'string' || id.trim() === '' || typeof token !== 'string' || token.trim() === '')
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });

  // 구독 부재와 토큰 불일치를 같은 응답으로 답한다 — booking/cancel.ts와 동일 원칙
  // (구분해 알려주면 id 존재 여부를 토큰 없이도 확인하는 창구가 된다).
  const found = await findSubscriptionForManage(id, token);
  if (!found.ok) return res.status(404).json({ ok: false, message: '구독을 찾을 수 없어요.' });

  const now = new Date();
  const result = await cancelSubscription(id, { requestedBy: 'customer', reason: '고객 셀프 해지' }, now);
  if (!result.ok) {
    return res.status(409).json({
      ok: false,
      code: result.code,
      message: result.code === 'invalid_state' ? '이미 해지되었거나 해지할 수 없는 상태예요.' : '구독을 찾을 수 없어요.',
    });
  }

  const endsAt = result.subscription.endsAt ?? now;
  const firstPaidAt = await firstPaidAtOf(id).catch((error: unknown) => {
    console.error('[subscriptions/cancel] 첫 결제 시각 조회 실패 — 환불 힌트 없이 알린다', { id, error });
    return null;
  });
  const paidCycles = await paidCycleCountOf(id).catch(() => 0);
  const hint = refundHint(result.subscription.kind, firstPaidAt, paidCycles, now);
  const emailError = await sendSubscriptionCancelledEmail(result.subscription, { endsAt, refundNote: hint.customer });
  if (emailError) console.error('[subscriptions/cancel] 해지 확인 메일 발송 실패', { id, emailError });
  // 셀프 해지는 운영자가 알아야 환불 약속(청약철회·첫 수업 전)을 지킬 수 있다 — 관리자 해지·계약 종료와 같은 알림.
  const alertError = await sendSubscriptionOperatorAlert(result.subscription, 'cancelled', `고객 셀프 해지 — ${hint.operator}`);
  if (alertError) console.error('[subscriptions/cancel] 해지 운영자 알림 발송 실패', { id, alertError });

  return res.status(200).json({ ok: true, endsAt: endsAt.toISOString() });
}
