/**
 * 보관 기간이 지난 후원의 배송지 개인정보를 파기한다.
 *
 * 펀딩 약관 제13조·처리방침 8항으로 고객에게 "리워드 전달 완료 후 1년 보관한 뒤 지체 없이
 * 파기한다"고 약속했으므로, 사람이 기억해서 지우는 방식이면 지켜지지 않는다.
 * Vercel Cron이 월 1회 호출한다(계약서 purge-contracts와 같은 주기, 시간은 겹치지 않게
 * 매월 2일 18시로 잡는다 — purge-contracts는 매월 1일 18시).
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { purgeExpiredFundingPersonalData, REWARD_RETENTION_YEARS } from '../../../lib/funding/retention';
import { sendEmail } from '../../../lib/email/resend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/purge-funding')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const result = await purgeExpiredFundingPersonalData();
    return res.status(200).json({ ok: true, ...result });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/purge-funding] Failed:', error);

    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 펀딩 개인정보 파기 실패',
      text:
        `리워드 전달 후 ${REWARD_RETENTION_YEARS}년이 지난 후원의 배송지 개인정보 파기 작업이 실패했습니다.\n\n` +
        `사유: ${detail}\n\n` +
        '펀딩 약관 제13조로 약속한 파기이므로 확인이 필요합니다.',
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '개인정보 파기 작업에 실패했습니다.' });
  }
}
