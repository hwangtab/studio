/**
 * Instagram·Threads 장기 토큰 주간 갱신.
 *
 * 영구 토큰이 없어서 하는 일이다(lib/social/tokens.ts 머리말). 정상이면 조용히 끝나고,
 * 사람이 움직여야 하는 경우(토큰 없음·만료·갱신 실패)에만 운영자에게 메일을 보낸다 —
 * health-check와 같은 판단: 매주 "정상입니다"를 보내면 정작 문제인 주의 메일이 묻힌다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 * 비용: 주 1회, 요청 두 개(플랫폼당 GET 하나)와 Turso 읽기·쓰기 각 두 번. 사실상 0이다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { isCronAuthorized } from '../../../lib/cron/auth';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { formatOutcomes, needsAttention, refreshAll } from '../../../lib/social/tokens';

export const config = { maxDuration: 30 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/social-refresh')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const outcomes = await refreshAll();
    const attention = outcomes.filter(needsAttention);
    if (attention.length > 0) console.warn('[cron/social-refresh]', formatOutcomes(outcomes).replace(/\n/g, ' | '));

    if (attention.length > 0) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: `[Studio NOL] 소셜 토큰 처리 필요 — ${attention.map((o) => o.platform).join(', ')}`,
        text:
          '소셜 API 토큰 주간 갱신에서 사람이 처리해야 할 항목이 있습니다.\n\n' +
          formatOutcomes(outcomes) +
          '\n\n재승인: node --env-file=.env.local scripts/social/auth.mjs --platform <ig|threads>',
      }).catch((error: unknown) => console.error('[cron/social-refresh] 알림 메일 실패:', error));
    }

    return res.status(200).json({ ok: attention.length === 0, outcomes });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/social-refresh] Failed:', error);
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 소셜 토큰 갱신 실패',
      text: `주간 토큰 갱신이 실행되지 못했습니다. 반복되면 토큰이 만료됩니다.\n\n사유: ${detail}`,
    }).catch(() => {});
    return res.status(500).json({ ok: false, message: '갱신에 실패했습니다.' });
  }
}
