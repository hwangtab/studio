/**
 * 이용 후 후기 요청 메일 — 매일 11:00 KST(02:00 UTC). 판정은 `lib/reviews/reviewRequests.ts`.
 *
 * 발송 실패는 운영자에게 알린다. 일시적 실패는 기록을 되돌려 7일 창 안의 다음 실행이 다시
 * 시도하고, 반송·시간 초과는 기록을 남겨 다시 보내지 않는다(lib/reviews/reviewRequests.ts).
 * 같은 실패가 며칠 이어지면 Resend 설정을 본다.
 *
 * `review_requests` 표가 없으면(마이그레이션 0038 미적용) 던지고 500이 된다 — 조용히 0건으로
 * 끝나면 후기 요청이 영영 안 나가는데 아무도 모른다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { isCronAuthorized } from '../../../lib/cron/auth';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { runReviewRequests } from '../../../lib/reviews/reviewRequests';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isCronAuthorized(req, 'cron/review-requests')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const result = await runReviewRequests(new Date());
    if (result.failed.length > 0) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: `[스튜디오 놀] 후기 요청 메일 ${result.failed.length}건 발송 실패`,
        text: [
          `오늘 후기 요청 메일 ${result.sent}건을 보냈고 ${result.failed.length}건은 실패했습니다.`,
          '일시적 오류(API·네트워크)는 내일 다시 시도합니다(이용 후 7일까지).',
          '반송될 주소(UNDELIVERABLE_ADDRESS)와 시간 초과(TIMEOUT)는 두 통이 가지 않게 다시 보내지 않습니다.',
          '',
          ...result.failed.map((f) => `- ${f.refId}: ${f.code}`),
        ].join('\n'),
      });
    }
    console.log(`[cron/review-requests] sent=${result.sent} skipped=${result.skipped} failed=${result.failed.length}`);
    return res.status(200).json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error('[cron/review-requests] 실패:', error);
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}
