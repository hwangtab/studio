/**
 * 제작 계약 기한 점검 — 매일 10:00 KST(vercel.json). lib/contracts/production/progress.ts runProductionDeadlines.
 *
 * 간주 승인 기록(제5조 5항)·기한 안내 메일을 처리하고, 운영자에게 오늘 할 일 요약을 보낸다(할 일이 있을 때만).
 * 통째로 실패하면 운영자에게 알린다 — 조용히 멈추면 간주 승인도 기한 안내도 없이 날짜만 지나간다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { runProductionDeadlines } from '../../../lib/contracts/production/progress';
import { sendOperatorTodoDigest } from '../../../lib/contracts/production/progress-email';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { buildOperatorAlertHtml } from '../../../lib/email/operatorAlert';
import { sendEmail } from '../../../lib/email/resend';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/production-contract-deadlines')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const result = await runProductionDeadlines();
    if (result.todoContracts.length > 0) {
      const digest = await sendOperatorTodoDigest(result.todoContracts);
      if (!digest.ok) console.error('[cron/production-contract-deadlines] Digest email failed:', digest.errorCode);
    }
    const summary = {
      deemedApprovals: result.deemedApprovals,
      reminders: result.reminders,
      todoContracts: result.todoContracts.length,
      failed: result.failed,
    };
    return res.status(result.failed > 0 ? 500 : 200).json({ ok: result.failed === 0, ...summary });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/production-contract-deadlines] Failed:', error);
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 제작 계약 기한 점검 실패',
      text: `제작 계약 기한 점검(간주 승인·기한 안내)이 실패했습니다.\n\n사유: ${detail}`,
      html: buildOperatorAlertHtml({
        title: '제작 계약 기한 점검이 실패했습니다',
        cron: 'cron/production-contract-deadlines',
        reason: detail,
        hints: ['간주 승인(계약서 제5조 5항)과 기한 안내가 오늘 처리되지 않았습니다. 관리자 화면에서 진행 중인 계약을 확인해 주세요.'],
      }),
    }).catch(() => {});
    return res.status(500).json({ ok: false, message: '기한 점검에 실패했습니다.' });
  }
}
