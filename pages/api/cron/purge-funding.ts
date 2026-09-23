/**
 * 보관 기간이 지난 후원의 배송지 개인정보를 파기한다.
 *
 * 펀딩 약관 제13조·처리방침 8항으로 고객에게 "리워드 전달 완료 후 1년 보관한 뒤 지체 없이
 * 파기한다"고 약속했으므로, 사람이 기억해서 지우는 방식이면 지켜지지 않는다.
 * Vercel Cron이 월 1회 호출한다(계약서 purge-contracts와 같은 주기, 시간은 겹치지 않게
 * 매월 2일 18시로 잡는다 — purge-contracts는 매월 1일 18시).
 *
 * **같은 크론이 접속기록도 정리한다(기준은 다르다).** `privacy_access_logs`는 「개인정보의
 * 안전성 확보조치 기준」 제8조①에 따라 **2년** 보관이고, 위 배송지 파기는 약관·처리방침이
 * 약속한 1년(법정 보존 5년 우선)이다. 두 기준을 한 함수에 섞으면 접속기록이 법이 요구하는
 * 기간보다 먼저 지워지므로, `purgeExpiredFundingPersonalData`는 이 표를 아예 모른다 —
 * 호출만 나란히 둔다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { purgeExpiredFundingPersonalData, REWARD_RETENTION_YEARS } from '../../../lib/funding/retention';
import {
  purgeExpiredPrivacyAccessLogs,
  PRIVACY_ACCESS_LOG_RETENTION_YEARS,
} from '../../../lib/privacy/accessLog';
import { sendEmail } from '../../../lib/email/resend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/purge-funding')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    // 접속기록 삭제는 배송지 파기가 성공한 뒤에 돈다. 한쪽이 던지면 catch로 떨어져 메일이
    // 가고, 다음 달 실행에서 남은 쪽이 다시 시도된다(둘 다 멱등이다).
    // purge-contracts와 달리 result.failed 분기가 없다 — 계약서 쪽은 계약마다 Blob 삭제 +
    // 두 테이블 업데이트를 순회해서 일부만 실패할 수 있지만, 여기는 한 번의 UPDATE...WHERE뿐이라
    // 외부 API 호출이 없고 부분 실패라는 상태 자체가 없다(전부 성공하거나 catch로 떨어진다).
    const result = await purgeExpiredFundingPersonalData();
    const accessLogs = await purgeExpiredPrivacyAccessLogs();
    return res.status(200).json({ ok: true, ...result, purgedAccessLogs: accessLogs.purged });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[cron/purge-funding] Failed:', error);

    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: '[Studio NOL] 펀딩 개인정보 파기 실패',
      text:
        `리워드 전달 후 ${REWARD_RETENTION_YEARS}년이 지난 후원의 배송지 개인정보 파기, 또는 ` +
        `보관 ${PRIVACY_ACCESS_LOG_RETENTION_YEARS}년이 지난 고유식별정보 접속기록 삭제가 실패했습니다.\n\n` +
        `사유: ${detail}\n\n` +
        '펀딩 약관 제13조로 약속한 파기이므로 확인이 필요합니다.',
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '개인정보 파기 작업에 실패했습니다.' });
  }
}
