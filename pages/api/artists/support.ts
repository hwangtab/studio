import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { subscriptions } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { isArtistSupportOpen } from '../../../lib/artistSupport/open';
import { billingDayForSignup, validateArtistSupportSignup } from '../../../lib/artistSupport/signup';
import { sendSubscriptionSetupEmail, subscriptionSetupUrl } from '../../../lib/billing/email';
import { createSubscription } from '../../../lib/billing/service';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';

/**
 * 아티스트 구독 신청 — 유일한 공개 자가 가입 경로.
 *
 * 연습실·레슨 구독은 관리자가 만들어 링크를 보내지만(관리자 경로만 있다), 아티스트 구독은
 * 후원자가 아티스트 페이지에서 직접 시작한다. 여기서 구독 행(pending_card)을 만들고 카드
 * 등록 화면(/ko/subscribe/[id]?token=)으로 보낸다 — 그 뒤는 연습실·레슨과 같은 길이다
 * (빌링키 발급 → 첫 결제 → 매월 청구).
 *
 * 토스 빌링 심사가 끝나기 전에는 닫혀 있다(lib/artistSupport/open.ts). 닫힌 동안 오는
 * 요청은 503으로 끝낸다 — 404가 아닌 이유는 "곧 열린다"를 페이지가 이미 말하고 있어서다.
 */
const CREATE_ERROR: Record<string, { status: number; message: string }> = {
  artist_required: { status: 400, message: '아티스트를 찾을 수 없습니다.' },
  artist_not_open: { status: 409, message: '이 아티스트는 아직 구독을 받지 않습니다.' },
  invalid_tier: { status: 400, message: '구독 등급을 골라 주세요.' },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  if (!isArtistSupportOpen()) {
    return res.status(503).json({ ok: false, code: 'closed', message: '아티스트 구독은 아직 열리지 않았습니다.' });
  }

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`artist_support_signup:ip:${ip}`, 10, 3600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const validated = validateArtistSupportSignup(req.body);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
  const v = validated.value;

  const now = new Date();
  const result = await createSubscription(
    {
      kind: 'artist-support',
      artistSlug: v.artistSlug,
      tierId: v.tierId,
      customerName: v.customerName,
      // 휴대폰은 선택인데 subscriptions.customerPhone은 NOT NULL이다(연습실·레슨은 필수).
      // 스키마를 느슨하게 푸는 대신 빈 문자열로 둔다 — 표시부는 '-'로 그린다.
      customerPhone: v.customerPhone,
      customerEmail: v.customerEmail,
      billingDay: billingDayForSignup(now),
      displayName: v.displayName,
      displayConsent: v.displayConsent,
    },
    now,
  );
  if (!result.ok) {
    const mapped = CREATE_ERROR[result.code] ?? { status: 400, message: '구독을 만들지 못했습니다.' };
    return res.status(mapped.status).json({ ok: false, code: result.code, message: mapped.message });
  }

  const setupUrl = subscriptionSetupUrl({ id: result.id }, result.setupToken);

  // 화면이 곧바로 카드 등록으로 넘어가지만, 창을 닫아 버린 사람을 위해 같은 링크를 메일로도 남긴다.
  // 메일 실패는 신청을 뒤집지 않는다 — 링크는 응답에 이미 실려 있다.
  const subscription = await getDb().query.subscriptions.findFirst({ where: (t, { eq: is }) => is(t.id, result.id) });
  if (subscription) {
    const notificationError = await sendSubscriptionSetupEmail(subscription, setupUrl);
    if (notificationError) {
      await getDb().update(subscriptions).set({ notificationError }).where(eq(subscriptions.id, result.id));
    }
  }

  return res.status(201).json({ ok: true, setupUrl });
}
