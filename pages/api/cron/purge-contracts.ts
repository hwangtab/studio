/**
 * 보관 기간이 지난 계약의 개인정보를 파기한다.
 *
 * 계약서 제12조로 고객에게 "계약 종료 후 3년간 보관한 뒤 파기한다"고 약속했으므로,
 * 사람이 기억해서 지우는 방식이면 지켜지지 않는다. Vercel Cron이 월 1회 호출한다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { purgeExpiredPersonalData, RETENTION_YEARS } from '../../../lib/contracts/retention';

const isAuthorized = (req: NextApiRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/purge-contracts] CRON_SECRET is not set.');
    return false;
  }
  return req.headers.authorization === `Bearer ${secret}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const result = await purgeExpiredPersonalData();

    if (result.failed > 0) {
      console.error(
        `[cron/purge-contracts] ${RETENTION_YEARS}년 경과 계약 파기 일부 실패: 성공 ${result.purged}건, 실패 ${result.failed}건`,
      );
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error('[cron/purge-contracts] Failed:', error);
    return res.status(500).json({ ok: false, message: '개인정보 파기 작업에 실패했습니다.' });
  }
}
