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
import { purgeExpiredLessonPersonalData } from '../../../lib/contracts/lesson/retention';
import { purgeExpiredProductionPersonalData } from '../../../lib/contracts/production/retention';
import { purgeExpiredPersonalData, RETENTION_YEARS } from '../../../lib/contracts/retention';
import { isMissingTableError } from '../../../lib/dbErrors';
import { buildOperatorAlertHtml } from '../../../lib/email/operatorAlert';
import { sendEmail } from '../../../lib/email/resend';
import { purgeExpiredSessionMusicians, sendSessionMusicianReconfirmNotices } from '../../../lib/sessionMusicians/retention';
import { purgeEndedTenancies } from '../../../lib/tenancy/retention';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isCronAuthorized(req, 'cron/purge-contracts')) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    // 각 파기는 던져도 다음 파기를 막지 않는다 — 계약 파기의 일시 오류로 세션 연주자·월 입주 파기와 재확인 메일까지
    // 그달 통째로 건너뛰지 않게(2026-10-23 리뷰). 던진 단계는 null로 남기고 아래 알림에 "실행 실패"로 적는다.
    const failedName = (error: unknown) => (error instanceof Error ? error.name : 'unknown');
    const result = await purgeExpiredPersonalData().catch((error: unknown) => {
      console.error('[cron/purge-contracts] 연습실 계약 파기 실행 실패', failedName(error));
      return null;
    });
    // 제작 계약(계약서 제13조 — 끝난 날부터 3년)도 같은 크론에서 파기한다. 실패 건수는 아래 알림에 합친다.
    const production = await purgeExpiredProductionPersonalData().catch((error: unknown) => {
      console.error('[cron/purge-contracts] 제작 계약 파기 실행 실패', failedName(error));
      return null;
    });
    // 월 입주 기록(퇴실 3년 개인정보·5년 전체)도 같은 달 크론에서 파기한다. 실패해도 계약 파기 결과를 가리지 않는다.
    const tenancy = await purgeEndedTenancies().catch((error: unknown) => {
      console.error('[cron/purge-contracts] 월 입주 기록 파기 실패', error instanceof Error ? error.name : 'unknown');
      return null;
    });

    // 프로듀싱 레슨 수강 계약(수강 종료 3년)·수강 등록 이름(5년)도 같은 달 크론에서 파기한다. 표가 없으면(0081·0082 전) 건너뛴다 — 지울 것이 없다.
    const lessons = await purgeExpiredLessonPersonalData().catch((error: unknown) => {
      // drizzle이 감싼 오류는 원문이 cause에 있다 — message만 보면 표가 없는 정상 상황을 매달 실패로 알린다.
      if (isMissingTableError(error)) return { contractsPurged: 0, enrollmentsCleared: 0 };
      console.error('[cron/purge-contracts] 레슨 기록 파기 실패', error instanceof Error ? error.name : 'unknown');
      return null;
    });

    // 세션 연주자 등록(마지막 확인 2년 — 처리방침 3항·18항 ⑯)도 같은 달 크론에서 지운다. 표가 없으면(0077 전) 건너뛴다.
    const sessionMusicians = await purgeExpiredSessionMusicians().catch((error: unknown) => {
      console.error('[cron/purge-contracts] 세션 연주자 등록 파기 실패', error instanceof Error ? error.name : 'unknown');
      return null;
    });
    // 1년 9개월째 재확인 메일. 메일 실패는 파기 약속을 깨는 일이 아니라 500으로 보지 않고, 운영자에게 알린다.
    const sessionReconfirm = await sendSessionMusicianReconfirmNotices().catch((error: unknown) => {
      console.error('[cron/purge-contracts] 세션 연주자 재확인 메일 처리 실패', error instanceof Error ? error.name : 'unknown');
      return null;
    });

    let anyFailed = false;

    /**
     * 일부라도 실패하면 알린다.
     *
     * 계약서 제12조로 "3년 뒤 파기한다"고 약속했으므로, 파기되지 않은 건이 있다는 사실은
     * 사람이 알아야 한다. 예전에는 로그만 남기고 200을 돌려줘서 크론은 성공으로 기록됐고,
     * 아무도 로그를 보지 않으면 약속이 조용히 깨진 채로 남았다.
     */
    if (result === null || production === null || result.failed > 0 || production.failed > 0) {
      const countText = (r: { purged: number; failed: number } | null) => (r === null ? '실행 실패(서버 로그 확인)' : `성공 ${r.purged}건 / 실패 ${r.failed}건`);
      const message =
        `${RETENTION_YEARS}년이 지난 계약의 개인정보 파기가 일부 실패했습니다.\n\n` +
        `연습실 계약: ${countText(result)}\n` +
        `제작 계약: ${countText(production)}\n` +
        `월 입주 기록: ${tenancy === null ? '실패(표·연결 확인 필요)' : `개인정보 ${tenancy.personalCleared}건 비움 / 기록 ${tenancy.recordsDeleted}건 삭제`}\n\n` +
        '계약서 제12조로 약속한 파기이므로 확인이 필요합니다. ' +
        '다음 주기에 다시 시도하지만, 반복되면 Turso와 Blob 설정을 확인해 주세요.';

      console.error(`[cron/purge-contracts] ${message}`);

      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: '[Studio NOL] 계약 개인정보 파기 일부 실패',
        text: message,
        html: buildOperatorAlertHtml({
          title: `${RETENTION_YEARS}년이 지난 계약의 개인정보 파기가 일부 실패했습니다`,
          cron: 'cron/purge-contracts',
          rows: [
            { label: '연습실 계약', value: countText(result), emphasis: result === null || result.failed > 0 },
            { label: '제작 계약', value: countText(production), emphasis: production === null || production.failed > 0 },
          ],
          hints: [
            '계약서 제12조로 약속한 파기이므로 확인이 필요합니다.',
            '다음 주기에 다시 시도하지만, 반복되면 Turso와 Blob 설정을 확인해 주세요.',
          ],
        }),
      }).catch(() => {});

      // 크론 실행 자체를 실패로 남긴다(맨 아래). 다른 파기의 실패 알림이 가려지지 않게 여기서 돌아가지 않는다 — 재시도는 안전하다(이미 파기된 건은 건너뛴다).

      anyFailed = true;
    }

    // 월 입주 기록 파기가 실패하면 알린다 — 처리방침 19항에서 "퇴실 3년·5년 뒤 지운다"고 약속했으므로 조용히 200으로 끝나면 안 된다(감사 2026-10-19).
    if (tenancy === null) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: '[Studio NOL] 월 입주 기록 파기 실패',
        text: '퇴실 후 3년(개인정보)·5년(기록 전체)이 지난 월 입주 기록의 파기가 실패했습니다.\n\n처리방침 19항으로 약속한 파기이므로 확인이 필요합니다. 다음 주기에 다시 시도하지만 반복되면 Turso 연결과 room_tenancies 표를 확인해 주세요.',
        html: buildOperatorAlertHtml({
          title: '월 입주 기록 파기가 실패했습니다',
          cron: 'cron/purge-contracts',
          hints: ['처리방침 19항으로 약속한 파기(퇴실 3년 개인정보·5년 기록 전체)입니다.', '반복되면 Turso 연결과 room_tenancies 표를 확인해 주세요.'],
        }),
      }).catch(() => {});
      // 크론 실행 자체를 실패로 남긴다(맨 아래). 다른 파기의 실패 알림이 가려지지 않게 여기서 돌아가지 않는다 — 재시도는 안전하다(이미 파기된 건은 건너뛴다).
      anyFailed = true;
    }

    // 레슨 기록 파기가 실패하면 알린다 — 수강 계약서 제10조·처리방침으로 약속한 파기(수강 종료 3년·5년)이므로 조용히 200으로 끝나면 안 된다.
    if (lessons === null) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: '[Studio NOL] 레슨 기록 파기 실패',
        text: '수강 종료 후 3년(수강 계약서 개인정보)·5년(수강 등록 이름)이 지난 레슨 기록의 파기가 실패했습니다.\n\n수강 계약서 제10조로 약속한 파기이므로 확인이 필요합니다. 다음 주기에 다시 시도하지만 반복되면 Turso 연결과 lesson_contracts·lesson_enrollments 표를 확인해 주세요.',
        html: buildOperatorAlertHtml({
          title: '레슨 기록 파기가 실패했습니다',
          cron: 'cron/purge-contracts',
          hints: ['수강 계약서 제10조로 약속한 파기(수강 종료 3년 계약서 개인정보·5년 수강 등록 이름)입니다.', '반복되면 Turso 연결과 lesson_contracts·lesson_enrollments 표를 확인해 주세요.'],
        }),
      }).catch(() => {});
      // 크론 실행 자체를 실패로 남긴다(맨 아래). 다른 파기의 실패 알림이 가려지지 않게 여기서 돌아가지 않는다 — 재시도는 안전하다(이미 파기된 건은 건너뛴다).
      anyFailed = true;
    }

    // 세션 연주자 등록 파기가 실패하면 알린다 — 처리방침 18항 ⑯에서 "마지막 확인 2년 뒤 지운다"고 약속했으므로 조용히 200으로 끝나면 안 된다.
    if (sessionMusicians === null) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: '[Studio NOL] 세션 연주자 등록 파기 실패',
        text: '마지막 확인 후 2년이 지난 세션 연주자 등록의 파기가 실패했습니다.\n\n처리방침 18항 ⑯으로 약속한 파기이므로 확인이 필요합니다. 다음 주기에 다시 시도하지만 반복되면 Turso 연결과 session_musicians 표를 확인해 주세요.',
        html: buildOperatorAlertHtml({
          title: '세션 연주자 등록 파기가 실패했습니다',
          cron: 'cron/purge-contracts',
          hints: ['처리방침 18항 ⑯으로 약속한 파기(마지막 확인 2년 뒤 행 삭제)입니다.', '반복되면 Turso 연결과 session_musicians 표를 확인해 주세요.'],
        }),
      }).catch(() => {});
      // 크론 실행 자체를 실패로 남긴다(맨 아래). 다른 파기의 실패 알림이 가려지지 않게 여기서 돌아가지 않는다 — 재시도는 안전하다(이미 파기된 건은 건너뛴다).
      anyFailed = true;
    }

    // 재확인 메일이 나가지 않은 건은 알리되 크론을 실패로 만들지 않는다 — 다음 달에 보유 기한 안에서 다시 시도한다.
    if (sessionReconfirm === null || sessionReconfirm.failed > 0) {
      await sendEmail({
        to: OPERATOR_EMAIL,
        subject: '[Studio NOL] 세션 연주자 재확인 메일 일부 실패',
        text: `보유 기간 재확인("아직 세션 연주 하세요?") 메일을 보내지 못한 등록이 있습니다. ${sessionReconfirm === null ? '처리 자체가 실패했습니다.' : `성공 ${sessionReconfirm.sent}건 / 실패 ${sessionReconfirm.failed}건`}\n\n다음 달 크론이 보유 기한(2년) 안에서 다시 시도합니다. 메일 주소가 잘못됐거나 반송되는 경우가 반복되면 해당 등록은 기한이 지날 때 지워집니다.`,
        html: buildOperatorAlertHtml({
          title: '세션 연주자 재확인 메일이 일부 나가지 않았습니다',
          cron: 'cron/purge-contracts',
          rows: sessionReconfirm === null ? [] : [
            { label: '재확인 메일 성공', value: `${sessionReconfirm.sent}건` },
            { label: '재확인 메일 실패', value: `${sessionReconfirm.failed}건`, emphasis: true },
          ],
          reason: sessionReconfirm === null ? '처리 자체가 실패했습니다. 서버 로그를 확인해 주세요.' : undefined,
          hints: ['다음 달 크론이 보유 기한(2년) 안에서 다시 시도합니다.'],
        }),
      }).catch(() => {});
    }

    const body = { ...result, production, tenancy, lessons, sessionMusicians, sessionReconfirm };
    if (anyFailed) return res.status(500).json({ ok: false, ...body });
    return res.status(200).json({ ok: true, ...body });
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
      html: buildOperatorAlertHtml({
        title: '보관 기간이 지난 계약의 개인정보 파기가 실패했습니다',
        cron: 'cron/purge-contracts',
        reason: detail,
        hints: ['계약서 제12조로 약속한 파기이므로 확인이 필요합니다.'],
      }),
    }).catch(() => {});

    return res.status(500).json({ ok: false, message: '개인정보 파기 작업에 실패했습니다.' });
  }
}
