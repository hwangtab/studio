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
import { purgeExpiredProductionPersonalData } from '../../../lib/contracts/production/retention';
import { purgeExpiredPersonalData, RETENTION_YEARS } from '../../../lib/contracts/retention';
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
    const result = await purgeExpiredPersonalData();
    // 제작 계약(계약서 제13조 — 끝난 날부터 3년)도 같은 크론에서 파기한다. 실패 건수는 아래 알림에 합친다.
    const production = await purgeExpiredProductionPersonalData();
    // 월 입주 기록(퇴실 3년 개인정보·5년 전체)도 같은 달 크론에서 파기한다. 실패해도 계약 파기 결과를 가리지 않는다.
    const tenancy = await purgeEndedTenancies().catch((error: unknown) => {
      console.error('[cron/purge-contracts] 월 입주 기록 파기 실패', error instanceof Error ? error.name : 'unknown');
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

    /**
     * 일부라도 실패하면 알린다.
     *
     * 계약서 제12조로 "3년 뒤 파기한다"고 약속했으므로, 파기되지 않은 건이 있다는 사실은
     * 사람이 알아야 한다. 예전에는 로그만 남기고 200을 돌려줘서 크론은 성공으로 기록됐고,
     * 아무도 로그를 보지 않으면 약속이 조용히 깨진 채로 남았다.
     */
    if (result.failed > 0 || production.failed > 0) {
      const message =
        `${RETENTION_YEARS}년이 지난 계약의 개인정보 파기가 일부 실패했습니다.\n\n` +
        `연습실 계약: 성공 ${result.purged}건 / 실패 ${result.failed}건\n` +
        `제작 계약: 성공 ${production.purged}건 / 실패 ${production.failed}건\n` +
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
            { label: '연습실 계약 성공', value: `${result.purged}건` },
            { label: '연습실 계약 실패', value: `${result.failed}건`, emphasis: result.failed > 0 },
            { label: '제작 계약 성공', value: `${production.purged}건` },
            { label: '제작 계약 실패', value: `${production.failed}건`, emphasis: production.failed > 0 },
          ],
          hints: [
            '계약서 제12조로 약속한 파기이므로 확인이 필요합니다.',
            '다음 주기에 다시 시도하지만, 반복되면 Turso와 Blob 설정을 확인해 주세요.',
          ],
        }),
      }).catch(() => {});

      // 크론 실행 자체를 실패로 남긴다. 재시도는 안전하다 — 이미 파기된 건은 건너뛴다.
      return res.status(500).json({ ok: false, ...result, production, sessionMusicians });
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
      return res.status(500).json({ ok: false, ...result, production, tenancy, sessionMusicians });
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
      return res.status(500).json({ ok: false, ...result, production, tenancy, sessionMusicians });
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

    return res.status(200).json({ ok: true, ...result, production, tenancy, sessionMusicians, sessionReconfirm });
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
