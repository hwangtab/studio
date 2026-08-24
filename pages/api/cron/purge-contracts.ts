/**
 * 보관 기간이 지난 계약의 개인정보를 파기한다.
 *
 * 계약서 제12조로 고객에게 "계약 종료 후 3년간 보관한 뒤 파기한다"고 약속했으므로,
 * 사람이 기억해서 지우는 방식이면 지켜지지 않는다. Vercel Cron이 월 1회 호출한다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { purgeExpiredPersonalData, RETENTION_YEARS } from '../../../lib/contracts/retention';
import { sendEmail } from '../../../lib/email/resend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/purge-contracts')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const result = await purgeExpiredPersonalData();

    /**
     * 일부라도 실패하면 알린다.
     *
     * 계약서 제12조로 "3년 뒤 파기한다"고 약속했으므로, 파기되지 않은 건이 있다는 사실은
     * 사람이 알아야 한다. 예전에는 로그만 남기고 200을 돌려줘서 크론은 성공으로 기록됐고,
     * 아무도 로그를 보지 않으면 약속이 조용히 깨진 채로 남았다.
     */
    if (result.failed > 0) {
      const message =
        `${RETENTION_YEARS}년이 지난 계약의 개인정보 파기가 일부 실패했습니다.\n\n` +
        `성공 ${result.purged}건 / 실패 ${result.failed}건\n\n` +
        '계약서 제12조로 약속한 파기이므로 확인이 필요합니다. ' +
        '다음 주기에 다시 시도하지만, 반복되면 Turso와 Blob 설정을 확인해 주세요.';

      console.error(`[cron/purge-contracts] ${message}`);

      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: '[Studio NOL] 계약 개인정보 파기 일부 실패',
        text: message,
      }).catch(() => {});

      // 크론 실행 자체를 실패로 남긴다. 재시도는 안전하다 — 이미 파기된 건은 건너뛴다.
      return res.status(500).json({ ok: false, ...result });
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/purge-contracts] Failed:', error);

    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 계약 개인정보 파기 실패',
      text:
        '보관 기간이 지난 계약의 개인정보 파기 작업이 실패했습니다.\n\n' +
        `사유: ${detail}\n\n` +
        '계약서 제12조로 약속한 파기이므로 확인이 필요합니다.',
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '개인정보 파기 작업에 실패했습니다.' });
  }
}
