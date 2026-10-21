/**
 * 레슨 수업 전날 안내 메일 — 매일 10:00 KST(01:00 UTC). 판정은 `lib/lessons/reminders.ts`.
 * 수강 계약에 서명한 수강생에게만 간다. 실패는 운영자에게 알린다 — 수업 전날 한 번뿐인 안내라 다시 보내지 않으므로, 실패한 분에게는 직접 연락한다.
 * 표가 없으면(마이그레이션 0083 미적용) 던지고 500이 된다 — 조용히 0건으로 끝나면 안내가 영영 안 나가는데 아무도 모른다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { isCronAuthorized } from '../../../lib/cron/auth';
import { buildOperatorAlertHtml } from '../../../lib/email/operatorAlert';
import { sendEmail } from '../../../lib/email/resend';
import { sendLessonReminders } from '../../../lib/lessons/reminders';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isCronAuthorized(req, 'cron/lesson-reminders')) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (process.env.LESSON_REMINDERS === 'off') return res.status(200).json({ ok: true, skipped: true });

  try {
    const result = await sendLessonReminders(new Date());
    if (result.failed.length > 0) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: `[스튜디오 놀] 레슨 전날 안내 메일 ${result.failed.length}건 발송 실패`,
        text: [
          `내일 레슨 안내 메일 ${result.sent}건을 보냈고 ${result.failed.length}건은 실패했습니다.`,
          '수업 전날 한 번뿐인 안내라 다시 보내지 않습니다 — 해당 수강생에게 직접 연락해 주세요(레슨 관리에서 내일 수업을 확인하세요).',
          '', ...result.failed.map((f) => `- 회차 ${f.refId}: ${f.code}`),
        ].join('\n'),
        html: buildOperatorAlertHtml({
          title: `레슨 전날 안내 메일 ${result.failed.length}건 발송에 실패했습니다`,
          cron: 'cron/lesson-reminders',
          rows: [{ label: '발송', value: `${result.sent}건` }, { label: '실패', value: `${result.failed.length}건`, emphasis: true }],
          reason: result.failed.map((f) => `회차 ${f.refId}: ${f.code}`).join('\n'),
          hints: ['수업 전날 한 번뿐인 안내라 다시 보내지 않습니다 — 해당 수강생에게 직접 연락해 주세요.'],
        }),
      }).catch(() => undefined);
    }
    console.log(`[cron/lesson-reminders] considered=${result.considered} sent=${result.sent} failed=${result.failed.length}`);
    return res.status(200).json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error('[cron/lesson-reminders] 실패:', error);
    const message = error instanceof Error ? error.message : String(error);
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[스튜디오 놀] 레슨 전날 안내 크론 실패',
      text: `오늘 레슨 전날 안내 크론이 통째로 실패해 한 통도 보내지 못했습니다.\n오류: ${message}\n\nlesson_reminders 표가 없다는 오류면 마이그레이션 0083 적용 여부부터 보세요(CLAUDE.md "운영 DB 마이그레이션 적용 방법"). 내일 수업을 레슨 관리에서 확인해 직접 연락해 주세요.`,
      html: buildOperatorAlertHtml({
        title: '레슨 전날 안내 크론이 실패했습니다',
        cron: 'cron/lesson-reminders',
        reason: message,
        hints: ['lesson_reminders 표가 없다는 오류면 마이그레이션 0083 적용 여부부터 보세요.', '내일 수업을 레슨 관리에서 확인해 직접 연락해 주세요.'],
      }),
    }).catch(() => undefined);
    return res.status(500).json({ ok: false, message: '레슨 전날 안내에 실패했습니다.' });
  }
}
