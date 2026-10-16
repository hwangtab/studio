/**
 * 원장(주문·결제·환불·후원·구독·공연) 일일 백업 — lib/ops/ledgerBackup.ts.
 *
 * 운영 Turso의 시점 복구는 1일뿐이라(starter 플랜) 하루 넘겨 발견한 사고는 이 백업이 유일한 근거다.
 * 실패는 운영자에게 메일로 알린다(backup-contracts와 같은 판단).
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { backupLedger } from '../../../lib/ops/ledgerBackup';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { buildOperatorAlertHtml } from '../../../lib/email/operatorAlert';
import { sendEmail } from '../../../lib/email/resend';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/backup-ledger')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const result = await backupLedger();
    return res.status(200).json({ ok: true, ...result });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/backup-ledger] Failed:', error);
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 원장 백업 실패',
      text:
        '주문·결제·환불·후원·구독 원장 백업이 실패했습니다.\n\n' +
        `사유: ${detail}\n\n` +
        '운영 DB의 시점 복구는 1일뿐이라 백업이 비는 날은 복구 근거가 없습니다. 반복되면 Turso와 Blob 설정을 확인해 주세요.',
      html: buildOperatorAlertHtml({
        title: '원장 백업이 실패했습니다',
        cron: 'cron/backup-ledger',
        summary: '운영 DB의 시점 복구는 1일뿐이라, 백업이 비는 날은 복구 근거가 없습니다.',
        reason: detail,
        hints: ['반복되면 Turso와 Blob 설정을 확인해 주세요.'],
      }),
    }).catch(() => {});
    return res.status(500).json({ ok: false, message: '백업에 실패했습니다.' });
  }
}
