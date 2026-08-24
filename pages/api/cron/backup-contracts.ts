/**
 * 계약 데이터를 주기적으로 백업하고, 주인 없는 PDF를 정리한다.
 *
 * Turso가 유일본이라 DB를 잃으면 어떤 계약이 있었는지조차 알 수 없다. 백업이 실패하면
 * "백업이 없다"는 사실을 아무도 모른 채 지나가므로, 실패는 운영자에게 메일로 알린다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { backupContracts } from '../../../lib/contracts/backup';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { sendEmail } from '../../../lib/email/resend';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/backup-contracts')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const result = await backupContracts();
    return res.status(200).json({ ok: true, ...result });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/backup-contracts] Failed:', error);

    // 조용히 실패하면 백업이 없다는 사실을 사고가 난 뒤에야 알게 된다.
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 계약 데이터 백업 실패',
      text:
        '계약 데이터 백업이 실패했습니다.\n\n' +
        `사유: ${detail}\n\n` +
        '다음 주기에 다시 시도하지만, 반복되면 Turso와 Blob 설정을 확인해 주세요.',
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '백업에 실패했습니다.' });
  }
}
