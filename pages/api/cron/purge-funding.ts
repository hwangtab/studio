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
 * **세 번째 파기도 기준이 또 다르다.** 개설자 주민등록번호(`funding_creators.
 * resident_number_enc`)는 원천징수한 정산의 **지급 시각**이 기산점이고 보관 기간도 따로다
 * (`purgeExpiredResidentNumbers`). 후원자 배송지 파기와 같은 함수에 넣으면 아직 지급명세서
 * 제출·수정신고가 남은 번호가 배송지와 함께 지워진다 — 그래서 함수도 기준도 분리한다.
 *
 * **네 번째 단계는 개인정보 파기가 아니다.** 아무 프로젝트도 참조하지 않는 개설자 업로드
 * 이미지를 저장소에서 지운다(`purgeOrphanFundingMedia`) — 대상이 파일이고 기준도 다르므로
 * 함수를 따로 두고 호출만 나란히 둔다.
 *
 * 인증: Vercel Cron이 Authorization: Bearer ${CRON_SECRET} 헤더를 붙인다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { isCronAuthorized } from '../../../lib/cron/auth';
import {
  purgeExpiredFundingPersonalData,
  purgeExpiredResidentNumbers,
  RESIDENT_NUMBER_RETENTION_YEARS,
  REWARD_RETENTION_YEARS,
} from '../../../lib/funding/retention';
import { purgeOrphanFundingMedia } from '../../../lib/funding/mediaRetention';
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

  /**
   * 세 파기는 **서로의 실패에 걸리지 않는다.**
   *
   * 예전엔 셋을 한 try에 나란히 세워 두어, 앞의 것이 던지면 뒤의 것이 그달에 아예 실행되지
   * 않았다. 실제로 일어날 수 있는 형태가 있다: 운영 DB에 마이그레이션이 적용되기 전에 코드가
   * 먼저 배포되면 `privacy_access_logs` 조회가 `no such table`을 던지고, 그 뒤에 서 있던
   * 주민등록번호 파기가 한 번도 돌지 않는다 — 처리방침이 약속한 월 1회 자동 파기가 표 하나
   * 때문에 통째로 멈춘다. 배포 순서(마이그레이션 먼저)가 정답인 것은 그대로지만, 그 실수
   * 하나에 다른 약속까지 무너질 이유는 없다.
   *
   * 셋은 대상도 기산점도 기간도 다른 별개의 파기다(머리주석 참조). 전부 멱등이라 실패한
   * 것은 다음 달 실행에서 다시 시도된다.
   */
  const failures: { label: string; detail: string }[] = [];

  const run = async <T>(label: string, task: () => Promise<T>): Promise<T | null> => {
    try {
      return await task();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[cron/purge-funding] ${label} 실패:`, error);
      failures.push({ label, detail });
      return null;
    }
  };

  // purge-contracts와 달리 result.failed 분기가 없다 — 계약서 쪽은 계약마다 Blob 삭제 +
  // 두 테이블 업데이트를 순회해서 일부만 실패할 수 있지만, 여기는 각각 한 번의
  // UPDATE...WHERE·DELETE...WHERE뿐이라 외부 API 호출이 없고 부분 실패라는 상태가 없다
  // (하나하나는 전부 성공하거나 던진다).
  const result = await run(
    `리워드 전달 후 ${REWARD_RETENTION_YEARS}년이 지난 후원의 배송지 개인정보 파기`,
    purgeExpiredFundingPersonalData,
  );
  const accessLogs = await run(
    `보관 ${PRIVACY_ACCESS_LOG_RETENTION_YEARS}년이 지난 고유식별정보 접속기록 삭제`,
    purgeExpiredPrivacyAccessLogs,
  );
  const residentNumbers = await run(
    `원천징수 정산 지급 후 ${RESIDENT_NUMBER_RETENTION_YEARS}년이 지난 개설자 주민등록번호 파기`,
    purgeExpiredResidentNumbers,
  );

  /**
   * 네 번째는 개인정보 파기가 아니라 **저장소 청소**다.
   *
   * 아무 프로젝트도 가리키지 않는 업로드 이미지를 지운다(`purgeOrphanFundingMedia`).
   * 기준이 다른 만큼 함수도 따로 두고, 앞의 셋과 마찬가지로 서로의 실패에 걸리지 않는다.
   * 월 1회면 충분하다 — 고아 파일은 7일 유예를 지나야 대상이 되고, 며칠 늦게 지워지는
   * 것에 비용이 없다.
   */
  const media = await run(
    '아무 프로젝트도 참조하지 않는 개설자 업로드 이미지 정리',
    () => purgeOrphanFundingMedia(),
  );

  // 성공한 것은 건수를, 실패한 것은 null을 싣는다 — "0건 파기"와 "돌지 못함"은 다른 상태다.
  const body = {
    purged: result ? result.purged : null,
    purgedAccessLogs: accessLogs ? accessLogs.purged : null,
    purgedResidentNumbers: residentNumbers ? residentNumbers.purged : null,
    orphanMedia: media,
  };

  if (failures.length > 0) {
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[Studio NOL] 펀딩 개인정보 파기 실패 (${failures.length}건)`,
      text:
        `아래 파기 작업이 실패했습니다.\n\n${failures
          .map(({ label, detail }) => `· ${label}\n  사유: ${detail}`)
          .join('\n\n')}\n\n` +
        `함께 돌린 작업 중 성공한 것: ${
          [
            result ? `배송지 ${result.purged}건` : null,
            accessLogs ? `접속기록 ${accessLogs.purged}건` : null,
            residentNumbers ? `주민등록번호 ${residentNumbers.purged}건` : null,
            media
              ? `고아 이미지 ${media.deleted}건 삭제(${media.scanned}개 검사, 유예 ${media.skippedRecent}개, 실패 ${media.failed}건)`
              : null,
          ]
            .filter(Boolean)
            .join(', ') || '없음'
        }\n\n` +
        '펀딩 약관 제13조·처리방침으로 약속한 파기이므로 확인이 필요합니다. ' +
        '표가 없다는 사유라면 운영 DB에 마이그레이션이 적용됐는지 먼저 확인해 주세요.',
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '개인정보 파기 작업에 실패했습니다.', ...body });
  }

  return res.status(200).json({ ok: true, ...body });
}
